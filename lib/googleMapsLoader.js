let loadPromise = null;

export function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google && window.google.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.onload = () => resolve();
    script.onerror = () => { loadPromise = null; reject(new Error('تعذر تحميل خرائط Google — تأكد المفتاح صحيح')); };
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function getSavedApiKey() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('gmaps_api_key') || '';
}
