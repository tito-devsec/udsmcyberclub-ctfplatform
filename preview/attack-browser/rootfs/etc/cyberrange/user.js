// The profile Firefox starts with in the attack box: dark like Kali's, quiet on its first start,
// and drawn without a graphics card, which the server does not have.
user_pref("extensions.activeThemeID", "firefox-compact-dark@mozilla.org");
user_pref("ui.systemUsesDarkTheme", 1);
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("trailhead.firstrun.didSeeAboutWelcome", true);
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.tabs.warnOnClose", false);
user_pref("browser.warnOnQuit", false);
user_pref("browser.sessionstore.resume_from_crash", true);
user_pref("browser.translations.automaticallyPopup", false);
user_pref("browser.newtabpage.activity-stream.showSponsored", false);
user_pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
user_pref("browser.urlbar.suggest.quicksuggest.sponsored", false);
user_pref("signon.rememberSignons", false);
user_pref("media.autoplay.default", 5);
user_pref("browser.cache.disk.capacity", 262144);
user_pref("gfx.webrender.software", true);
user_pref("layers.acceleration.disabled", true);
user_pref("network.dns.disablePrefetch", true);
user_pref("network.prefetch-next", false);
// Less talk with Mozilla's services in the background: every student's Firefox shares the
// server's connection. Its security lists (blocklists, revoked certificates) stay on.
user_pref("app.normandy.enabled", false);
user_pref("app.shield.optoutstudies.enabled", false);
user_pref("dom.push.enabled", false);
user_pref("geo.enabled", false);
user_pref("network.captive-portal-service.enabled", false);
user_pref("network.connectivity-service.enabled", false);
user_pref("extensions.systemAddon.update.enabled", false);
user_pref("browser.region.update.enabled", false);
user_pref("browser.region.network.url", "");
