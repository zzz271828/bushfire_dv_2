(function () {
  const root = document.documentElement;
  const video = document.getElementById("heroVideo");
  let rafPending = false;
  let hasResetToStart = false;
  let lastHeroFade = "";
  let lastVideoFade = "";
  let lastDashOpacity = "";

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function updateScroll() {
    rafPending = false;
    const fadeDistance = window.innerHeight * 1.2;
    const progress = Math.min(1, Math.max(0, window.scrollY / fadeDistance));
    const eased = easeInOut(progress);

    const dashboardFadeDistance = window.innerHeight * 0.28;
    const dashProgress = Math.min(
      1,
      Math.max(0, window.scrollY / dashboardFadeDistance)
    );
    const dashEased = easeInOut(dashProgress);
    const dashboardOpacity = 0.7 + dashEased * 0.23;

    const heroFade = (1 - eased).toFixed(3);
    const videoFade = eased.toFixed(3);
    const dashOpacity = dashboardOpacity.toFixed(3);
    if (heroFade !== lastHeroFade) {
      root.style.setProperty("--hero-img-fade", heroFade);
      lastHeroFade = heroFade;
    }
    if (videoFade !== lastVideoFade) {
      root.style.setProperty("--video-fade", videoFade);
      lastVideoFade = videoFade;
    }
    if (dashOpacity !== lastDashOpacity) {
      root.style.setProperty("--dashboard-opacity", dashOpacity);
      lastDashOpacity = dashOpacity;
    }

    if (eased > 0.12 && video.paused) {
      video.play().catch(function () {});
      hasResetToStart = false;
    }
    if (eased < 0.04 && !hasResetToStart) {
      video.pause();
      video.currentTime = 0;
      hasResetToStart = true;
    }
  }

  function scheduleUpdate() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(updateScroll);
  }

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  updateScroll();
})();
