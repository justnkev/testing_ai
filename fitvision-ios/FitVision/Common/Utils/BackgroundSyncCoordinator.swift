import Foundation

actor BackgroundSyncCoordinator {
    static let shared = BackgroundSyncCoordinator()

    private var isSyncing = false

    func performBackgroundRefresh() async {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }
        await CoreDataStack.shared.flushUploadQueue()
    }
}
