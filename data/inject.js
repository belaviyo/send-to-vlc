'use strict';

var urls = [];
var players = [];
var detected = false;

function action(srcs, player) {
  window.top.postMessage({
    source: 'embedded-script'
  }, '*');
  // security check
  srcs = srcs.filter(u => /^(https*|ftp):\/\//.test(u));
  urls.push(...srcs);
  // u.indexOf('googlevideo.com') === -1: this extension is not a YouTube downloader
  urls = urls.filter((u, i, l) => u && l.indexOf(u) === i && u.indexOf('googlevideo.com') === -1);
  urls = urls.slice(-200);

  players.push(player);
  players = players.filter((p, i, l) => p && l.indexOf(p) === i);

  if (urls.length) {
    chrome.runtime.sendMessage({
      method: 'show-button',
      count: urls.length
    });
  }
}

window.addEventListener('message', e => {
  if (e.data && e.data.source === 'xmlhttprequest-open') {
    action([e.data.url]);
  }
  else if (e.data && e.data.source === 'embedded-script') {
    detected = true;
  }
});
document.addEventListener('canplay', function(e) {
  const target = e.target;
  action([target, ...target.querySelectorAll('source')].map(s => s.src), target);
}, true);

chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'get-urls') {
    if (request.pause) {
      players.forEach(p => {
        try {
          p.pause();
        }
        catch (e) {}
      });
    }
    if (urls.length) {
      chrome.runtime.sendMessage({
        method: request.reply,
        urls
      });
    }
    else if (window.location.hostname === 'www.youtube.com') {
      chrome.runtime.sendMessage({
        method: request.reply,
        urls: [window.location.href]
      });
    }
    else if (window === window.top && !detected) {
      chrome.runtime.sendMessage({
        method: request.reply,
        urls: [window.location.href]
      });
    }
  }
});

document.documentElement.appendChild(Object.assign(document.createElement('script'), {
  textContent: `
  {
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      open.apply(this, arguments);
      this.addEventListener('readystatechange', function _() {
        if(this.readyState == this.HEADERS_RECEIVED) {
          const contentType = this.getResponseHeader('Content-Type') || '';
          if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
            window.postMessage({
              source: 'xmlhttprequest-open',
              url,
              method,
              contentType
            }, '*');
          }
          this.removeEventListener('readystatechange', _);
        }
      })
    }
  }
  `
}));
