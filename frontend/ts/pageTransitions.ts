interface Window {
  pageTransitions: PageTransitions;
}

class PageTransitions {
  private readonly slowLoadMs = 140;
  private overlay: HTMLElement | null = null;
  private label: HTMLElement | null = null;
  private navigating = false;
  private loaderTimer = 0;

  public init(): void {
    this.injectStyles();
    this.createOverlay();
    this.bindPageLifecycle();
    this.bindLinks();
    this.preloadAppPages();

    requestAnimationFrame(() => {
      document.body.classList.add("page-loaded");
    });
  }

  public navigate(href: string, label = "Loading"): void {
    if (this.navigating) {
      return;
    }

    this.navigating = true;
    this.prepareNavigation(label);
    requestAnimationFrame(() => {
      window.location.href = href;
    });
  }

  public replace(href: string, label = "Loading"): void {
    if (this.navigating) {
      return;
    }

    this.navigating = true;
    this.prepareNavigation(label);
    requestAnimationFrame(() => {
      window.location.replace(href);
    });
  }

  private bindLinks(): void {
    document.addEventListener(
      "pointerover",
      (event) => {
        const link = this.getLink(event.target);
        if (link && this.isPageLink(link)) {
          this.prefetch(link.href);
        }
      },
      { passive: true },
    );

    document.addEventListener(
      "pointerdown",
      (event) => {
        const link = this.getLink(event.target);
        if (link && this.isPageLink(link)) {
          this.prefetch(link.href);
        }
      },
      { passive: true },
    );

    document.addEventListener("click", (event) => {
      const link = this.getLink(event.target);
      if (!link || !this.shouldTransition(event, link)) {
        return;
      }

      event.preventDefault();
      this.navigate(link.href, link.dataset.loadingLabel || "Loading page");
    });
  }

  private bindPageLifecycle(): void {
    window.addEventListener("pageshow", () => {
      this.navigating = false;
      window.clearTimeout(this.loaderTimer);
      document.body.classList.remove("is-navigating");
      this.overlay?.classList.remove("active");
    });
  }

  private shouldTransition(event: MouseEvent, link: HTMLAnchorElement): boolean {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target === "_blank" ||
      link.hasAttribute("download") ||
      link.dataset.noTransition === "true"
    ) {
      return false;
    }

    return this.isPageLink(link);
  }

  private isPageLink(link: HTMLAnchorElement): boolean {
    const url = new URL(link.href, window.location.href);
    const current = new URL(window.location.href);
    const samePageHash =
      url.origin === current.origin &&
      url.pathname === current.pathname &&
      url.search === current.search &&
      url.hash.length > 0;

    return (
      url.origin === window.location.origin &&
      url.href !== window.location.href &&
      !samePageHash &&
      !link.href.endsWith("#")
    );
  }

  private prepareNavigation(label: string): void {
    if (this.label) {
      this.label.textContent = label;
    }

    document.body.classList.add("is-navigating");
    window.clearTimeout(this.loaderTimer);
    this.loaderTimer = window.setTimeout(() => {
      this.overlay?.classList.add("active");
    }, this.slowLoadMs);
  }

  private getLink(target: EventTarget | null): HTMLAnchorElement | null {
    return target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
  }

  private prefetch(href: string): void {
    const url = new URL(href, window.location.href);
    if (
      url.origin !== window.location.origin ||
      document.querySelector(`link[rel="prefetch"][href="${url.href}"]`)
    ) {
      return;
    }

    const prefetch = document.createElement("link");
    prefetch.rel = "prefetch";
    prefetch.href = url.href;
    document.head.appendChild(prefetch);
  }

  private preloadAppPages(): void {
    const schedule = window.requestIdleCallback || ((callback: IdleRequestCallback) => window.setTimeout(callback, 1));
    schedule(() => {
      const hrefs = new Set<string>();
      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
        if (this.isPageLink(link)) {
          hrefs.add(new URL(link.href, window.location.href).href);
        }
      });

      hrefs.forEach((href) => this.prefetch(href));
    });
  }

  private createOverlay(): void {
    this.overlay = document.createElement("div");
    this.overlay.className = "page-transition-overlay";
    this.overlay.setAttribute("aria-live", "polite");
    this.overlay.innerHTML = `
      <div class="page-transition-box">
        <span class="page-transition-spinner" aria-hidden="true"></span>
        <span class="page-transition-label">Loading</span>
      </div>
    `;
    this.label = this.overlay.querySelector<HTMLElement>(".page-transition-label");
    document.body.appendChild(this.overlay);
  }

  private injectStyles(): void {
    if (document.getElementById("pageTransitionStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "pageTransitionStyles";
    style.textContent = `
      body.is-navigating {
        opacity: 0.99;
        pointer-events: none;
      }

      .page-transition-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        background: rgba(246, 248, 252, 0.36);
        opacity: 0;
        visibility: hidden;
        transition: opacity 90ms ease, visibility 90ms ease;
      }

      .page-transition-overlay.active {
        opacity: 1;
        visibility: visible;
      }

      .page-transition-box {
        min-width: 148px;
        min-height: 48px;
        padding: 10px 16px;
        border: 1px solid rgba(203, 213, 225, 0.9);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.98);
        color: #172033;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font: 700 14px Inter, system-ui, sans-serif;
      }

      .page-transition-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #cbd5e1;
        border-top-color: #2457f5;
        border-radius: 50%;
        animation: pageTransitionSpin 700ms linear infinite;
      }

      @keyframes pageTransitionSpin {
        to { transform: rotate(360deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        body,
        .page-transition-overlay {
          transition: none;
          animation: none;
        }

        .page-transition-spinner {
          animation-duration: 1200ms;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

window.pageTransitions = new PageTransitions();
window.pageTransitions.init();
