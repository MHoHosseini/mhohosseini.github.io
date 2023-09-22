<<<<<<< HEAD
document.addEventListener('DOMContentLoaded', function() {
    const mode_toggle = document.getElementById("light-toggle");

    mode_toggle.addEventListener("click", function() {
        toggleTheme(localStorage.getItem("theme"));
    });
});

=======
document.addEventListener("DOMContentLoaded",function(){document.getElementById("light-toggle").addEventListener("click",function(){toggleTheme(localStorage.getItem("theme"))})});
>>>>>>> ed4db9736df784e71a6530773c6ee409fb0006e5
