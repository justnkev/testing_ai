(function() {
  function init() {
    var feeds = document.querySelectorAll('.message-feed');
    if (!feeds.length) {
      return;
    }

    feeds.forEach(function(feed) {
      function scrollToBottom() {
        feed.scrollTop = feed.scrollHeight;
      }

      scrollToBottom();

      var observer = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].type === 'childList') {
            scrollToBottom();
            break;
          }
        }
      });

      observer.observe(feed, {
        childList: true,
        subtree: true
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
