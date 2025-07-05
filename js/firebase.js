// Firebase configuration and initialization
const firebaseConfig = {
    apiKey: "AIzaSyAYrwppelmTTJGwL0PW7B-IJbziyMSnQ94",
    authDomain: "tiradadi-76582.firebaseapp.com",
    databaseURL: "https://tiradadi-76582-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tiradadi-76582",
    storageBucket: "tiradadi-76582.firebasestorage.app",
    messagingSenderId: "876805392261",
    appId: "1:876805392261:web:64e30601a68d03d48966ec",
    measurementId: "G-P96P94JLMS"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Firebase helper functions
export const FirebaseHelper = {
    database,
    
    // Get reference to a specific path
    getRef(path) {
        return database.ref(path);
    },
    
    // Get reference to room
    getRoomRef(roomName) {
        return database.ref(`rooms/${roomName}`);
    },
    
    // Get reference to room users
    getRoomUsersRef(roomName) {
        return database.ref(`rooms/${roomName}/users`);
    },
    
    // Get reference to room messages
    getRoomMessagesRef(roomName) {
        return database.ref(`rooms/${roomName}/messages`);
    },
    
    // Get reference to room dice rolls
    getRoomDiceRef(roomName) {
        return database.ref(`rooms/${roomName}/dice`);
    },
    
    // Set data at path
    async setData(path, data) {
        try {
            await database.ref(path).set(data);
            return true;
        } catch (error) {
            console.error('Error setting data:', error);
            return false;
        }
    },
    
    // Update data at path
    async updateData(path, data) {
        try {
            await database.ref(path).update(data);
            return true;
        } catch (error) {
            console.error('Error updating data:', error);
            return false;
        }
    },
    
    // Remove data at path
    async removeData(path) {
        try {
            await database.ref(path).remove();
            return true;
        } catch (error) {
            console.error('Error removing data:', error);
            return false;
        }
    },
    
    // Listen for data changes
    listenToData(path, callback) {
        const ref = database.ref(path);
        ref.on('value', callback);
        return ref;
    },
    
    // Stop listening to data changes
    stopListening(ref) {
        if (ref) {
            ref.off();
        }
    },
    
    // Push new data (auto-generated key)
    async pushData(path, data) {
        try {
            const newRef = await database.ref(path).push(data);
            return newRef.key;
        } catch (error) {
            console.error('Error pushing data:', error);
            return null;
        }
    },
    
    // Generate unique user ID
    generateUserId() {
        return database.ref().push().key;
    },
    
    // Get current timestamp
    getTimestamp() {
        return firebase.database.ServerValue.TIMESTAMP;
    }
};

// Export database instance for direct access if needed
export { database };
export default FirebaseHelper;