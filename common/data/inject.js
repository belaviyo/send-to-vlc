'use strict';

var urls = [];
var players = [];

function action(srcs, player) {
  // security check
  srcs = srcs.filter(u => /^(https*|ftp):\/\//.test(u));
  urls.push(...srcs);
  urls = urls.filter((u, i, l) => u && l.indexOf(u) === i);
  urls = urls.slice(-200);

  if (player) {
    players.push(player);
    players = players.filter((p, i, l) => p && l.indexOf(p) === i);
  }
  if (urls.length) {
    chrome.runtime.sendMessage({
      method: 'show-button',
      count: urls.length
    });
  }
}

document.addEventListener('canplay', ({target}) => {
  action([target, ...target.querySelectorAll('source')].map(s => s.src), target);
}, true);

const script = document.createElement('script');
document.documentElement.appendChild(Object.assign(script, {
  // this method detects media files without the need to have a webRequest which requires persistent background page
  textContent: `{
    const script = document.currentScript;
    const post = detail => script.dispatchEvent(new CustomEvent('media-available', {
      detail
    }));
    // XMLHttpRequest
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      open.apply(this, arguments);
      this.addEventListener('readystatechange', function _() {
        if(this.readyState == this.HEADERS_RECEIVED) {
          const contentType = this.getResponseHeader('Content-Type') || '';
          if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
            post({url});
          }
          this.removeEventListener('readystatechange', _);
        }
      });
    };
    // Audio
    const play = Audio.prototype.play;
    Audio.prototype.play = function() {
      play.apply(this, arguments);
      post({
        url: this.src
      });
    };
  }`
}));
script.remove();
script.addEventListener('media-available', ({detail}) => action([detail.url]));
