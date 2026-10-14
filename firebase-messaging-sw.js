/* Recibe las notificaciones del Portal CONTAX aunque el portal esté cerrado.
   Debe estar en la raíz del sitio. Los datos de Firebase NO son secretos. */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBh_NxhM5h6x--ZwxwoUCYf0yhW7Mt9k_A',
  authDomain: 'portal-nummeros.firebaseapp.com',
  projectId: 'portal-nummeros',
  messagingSenderId: '924886635369',
  appId: '1:924886635369:web:48f940d324d4dfb518e3f8'
});
firebase.messaging();
// Al tocar la notificación, el SDK abre el portal en la sección indicada (fcmOptions.link).
