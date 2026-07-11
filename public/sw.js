self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('file');

        if (file) {
          await saveSharedFile(file);
        }
        
        return Response.redirect('/?shared=1', 303);
      } catch (err) {
        console.error('Error handling share target:', err);
        return Response.redirect('/?share_error=1', 303);
      }
    })());
  }
});

function saveSharedFile(file) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SimpleXSharedFiles', 1);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      store.put({ id: 'shared-file', file: file });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}
