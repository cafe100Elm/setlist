// Where optional sync connects to. This is public by design (every Firebase web
// app ships it); the database's own rules are what keep each person's log private.
// With an empty apiKey the Sync section is hidden and the app is device-only.
export default {
  apiKey: 'AIzaSyCl1ndarPhCuLDQsPpunpmlABAypuIWT0A',
  authDomain: 'setlist-log-sync.firebaseapp.com',
  projectId: 'setlist-log-sync',
  storageBucket: 'setlist-log-sync.firebasestorage.app',
  messagingSenderId: '970940007536',
  appId: '1:970940007536:web:b9ec1a0fae71982bf520b5',
};
