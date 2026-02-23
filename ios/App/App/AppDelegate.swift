import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    // ── Smooth page transitions (prevents white flash between pages) ──
    private var snapshotView: UIView?
    private var loadingObservation: NSKeyValueObservation?
    private var hasLoadedFirstPage = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Setup smooth page transitions once the WKWebView is ready
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.setupSmoothTransitions()
        }
        return true
    }

    // MARK: - Smooth Page Transitions

    /// Observes WKWebView's `isLoading` property.
    /// When a new navigation starts, a snapshot of the current page is placed
    /// over the webview so the user never sees a blank white flash.
    /// When the new page finishes loading, the snapshot fades out.
    private func setupSmoothTransitions() {
        guard let webView = findWKWebView(in: window?.rootViewController?.view) else {
            // Webview might not be ready yet – retry
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.setupSmoothTransitions()
            }
            return
        }

        loadingObservation = webView.observe(\.isLoading, options: [.new, .old]) { [weak self] wv, change in
            guard let self = self else { return }
            let wasLoading = change.oldValue ?? false
            let isLoading  = change.newValue ?? false

            if !wasLoading && isLoading && self.hasLoadedFirstPage {
                // Navigation started – freeze current page as a snapshot overlay
                self.captureSnapshot(of: wv)
            } else if wasLoading && !isLoading {
                // Navigation finished – reveal new page
                self.hasLoadedFirstPage = true
                self.revealNewPage()
            }
        }
    }

    private func findWKWebView(in view: UIView?) -> WKWebView? {
        guard let view = view else { return nil }
        if let wv = view as? WKWebView { return wv }
        for sub in view.subviews {
            if let wv = findWKWebView(in: sub) { return wv }
        }
        return nil
    }

    private func captureSnapshot(of webView: WKWebView) {
        guard snapshotView == nil, let parent = webView.superview else { return }
        // afterScreenUpdates: false = capture what's currently rendered (the old page)
        if let snap = webView.snapshotView(afterScreenUpdates: false) {
            snap.frame = webView.frame
            parent.insertSubview(snap, aboveSubview: webView)
            snapshotView = snap
        }
    }

    private func revealNewPage() {
        guard let snap = snapshotView else { return }
        // Short delay to let the new page render its first frame
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.03) {
            UIView.animate(withDuration: 0.06, animations: {
                snap.alpha = 0
            }) { _ in
                snap.removeFromSuperview()
                self.snapshotView = nil
            }
        }
    }

    // MARK: - Standard Lifecycle

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
