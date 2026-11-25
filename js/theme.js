"use strict";

/*
  Переключатель светлой и тёмной темы.
  Сам атрибут data-theme выставляется коротким скриптом в <head>,
  чтобы страница не мигала светлым фоном до загрузки стилей.
*/

(function () {
  var buttons = document.querySelectorAll("[data-theme-toggle]");

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  }

  function paint(theme) {
    var dark = theme === "dark";

    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", dark ? "true" : "false");
      button.setAttribute(
        "aria-label",
        dark ? "Включить светлую тему" : "Включить тёмную тему"
      );

      var icon = button.querySelector("[data-theme-icon]");
      var label = button.querySelector("[data-theme-label]");

      if (icon) icon.textContent = dark ? "☀" : "☾";
      if (label) label.textContent = dark ? "Светлая" : "Тёмная";
    });
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("familyBudget_theme", theme);
    paint(theme);
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      apply(currentTheme() === "dark" ? "light" : "dark");
    });
  });

  paint(currentTheme());
})();
