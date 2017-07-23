'use strict';

var os = 'windows';
if (navigator.userAgent.indexOf('Mac') !== -1) {
  os = 'mac';
}
else if (navigator.userAgent.indexOf('Linux') !== -1) {
  os = 'linux';
}
document.body.dataset.os = (os === 'mac' || os === 'linux') ? 'linux' : 'windows';

var notify = (function () {
  let parent = document.getElementById('notify');
  let elems = [];
  return {
    show: function (type, msg, delay) {
      let elem = document.createElement('div');
      elem.textContent = msg;
      elem.dataset.type = type;
      parent.appendChild(elem);
      window.setTimeout(() => {
        try {
          parent.removeChild(elem);
        }
        catch (e) {}
      }, delay || 3000);
      elems.push(elem);
    },
    destroy: function () {
      elems.forEach(elem => {
        try {
          parent.removeChild(elem);
        }
        catch (e) {}
      });
    }
  };
})();

document.addEventListener('click', e => {
  let target = e.target;
  if (target.dataset.cmd === 'download') {
    notify.show('info', 'Looking for the latest version of the native-client', 60000);
    let req = new window.XMLHttpRequest();
    req.open('GET', 'https://api.github.com/repos/belaviyo/native-client/releases/latest');
    req.responseType = 'json';
    req.onload = () => {
      try {
        chrome.downloads.download({
          url: req.response.assets.filter(a => a.name === os + '.zip')[0].browser_download_url,
          filename: os + '.zip'
        }, () => {
          notify.destroy();
          notify.show('success', 'Download is started. Extract and install when it is done');
          document.body.dataset.step = 1;
        });
      }
      catch (e) {
        notify.show('error', e.message || e);
      }
    };
    req.onerror = () => {
      notify('error', 'Something went wrong! Please download the package manually');
      window.setTimeout(() => {
        window.open('https://github.com/belaviyo/native-client/releases');
      }, 5000);
    };
    req.send();
  }
  else if (target.dataset.cmd === 'check') {
    chrome.runtime.sendNativeMessage('com.add0n.native_client', {
      method: 'spec'
    }, response => {
      console.error(response)
      if (response) {
        notify.show('success', 'Native client version is ' + response.version);
      }
      else {
        notify.show('error', 'Cannot find the native client. Follow the 3 steps to install the native client');
      }
    });
  }
  else if (target.dataset.cmd === 'options') {
    chrome.runtime.openOptionsPage();
  }
});
