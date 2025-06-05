import { usePWA } from "../contexts/PWAContext";

const PWAUpdateNotification: React.FC = () => {
  const { needRefresh, updateServiceWorker } = usePWA();

  const handleUpdate = async () => {
    await updateServiceWorker(true);
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed top-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
      <div className="flex items-center gap-3">
        <span className="text-lg">🔄</span>
        <div className="flex-1">
          <h4 className="font-medium text-sm">Update Available</h4>
          <p className="text-xs opacity-90">New version is ready to install</p>
        </div>
        <button
          onClick={handleUpdate}
          className="bg-white text-red-600 px-3 py-1 rounded text-xs font-medium hover:bg-gray-100 transition-colors"
        >
          Update
        </button>
      </div>
    </div>
  );
};

export default PWAUpdateNotification;
