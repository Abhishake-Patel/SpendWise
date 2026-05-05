// =====================================================
// auth.js — Firebase Authentication
// =====================================================

const Auth = (() => {

    // Sign up with email & password
    async function register(name, email, password) {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
        // Create user profile doc
        await DB.setProfile(cred.user.uid, { name, email, currency: 'CAD', createdAt: Date.now() });
        return cred.user;
    }

    // Sign in with email & password
    async function login(email, password) {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        return cred.user;
    }

    // Sign in with Google
    async function loginWithGoogle() {
        const cred = await auth.signInWithPopup(googleProvider);
        const user = cred.user;
        // Create profile if first time
        const profile = await DB.getProfile(user.uid);
        if (!profile) {
            await DB.setProfile(user.uid, {
                name: user.displayName || 'User',
                email: user.email,
                currency: 'CAD',
                createdAt: Date.now()
            });
        }
        return user;
    }

    // Sign out
    async function logout() {
        await auth.signOut();
    }

    // Auth state listener — calls onLogin(user) or onLogout()
    function onAuthStateChange(onLogin, onLogout) {
        auth.onAuthStateChanged(user => {
            if (user) onLogin(user);
            else onLogout();
        });
    }

    return { register, login, loginWithGoogle, logout, onAuthStateChange };
})();
