(function attachReloadGuard(global) {
  function bindReloadGuard(options) {
    const controller = options.controller;

    function shouldGuardReload() {
      return Boolean(
        controller
        && typeof controller.hasResearchStarted === "function"
        && controller.hasResearchStarted()
      );
    }

    global.addEventListener("beforeunload", (event) => {
      if (!shouldGuardReload()) {
        return undefined;
      }

      event.preventDefault();
      event.returnValue = "";
      return "";
    });
  }

  global.SGOAReloadGuard = {
    bindReloadGuard,
  };
}(window));
