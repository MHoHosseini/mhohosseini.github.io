<<<<<<< HEAD
// Initialize medium zoom.
$(document).ready(function() {
  medium_zoom = mediumZoom('[data-zoomable]', {
    background: getComputedStyle(document.documentElement)
        .getPropertyValue('--global-bg-color') + 'ee',  // + 'ee' for trasparency.
  })
});
=======
$(document).ready(function(){medium_zoom=mediumZoom("[data-zoomable]",{background:getComputedStyle(document.documentElement).getPropertyValue("--global-bg-color")+"ee"})});
>>>>>>> ed4db9736df784e71a6530773c6ee409fb0006e5
