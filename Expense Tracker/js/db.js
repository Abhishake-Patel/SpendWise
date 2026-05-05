// =====================================================
// db.js — Firestore Database Operations
// All data is scoped to users/{userId}/ ensuring privacy
// =====================================================

const DB = (() => {

    // ── Profile ──────────────────────────────────────
    async function getProfile(uid) {
        const doc = await db.collection('users').doc(uid).collection('profile').doc('data').get();
        return doc.exists ? doc.data() : null;
    }

    async function setProfile(uid, data) {
        await db.collection('users').doc(uid).collection('profile').doc('data').set(data, { merge: true });
    }

    // ── Expenses ─────────────────────────────────────
    async function addExpense(uid, expense) {
        const ref = await db.collection('users').doc(uid).collection('expenses').add({
            ...expense,
            createdAt: Date.now()
        });
        return ref.id;
    }

    async function getExpenses(uid) {
        const snap = await db.collection('users').doc(uid).collection('expenses')
            .orderBy('date', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function updateExpense(uid, id, data) {
        await db.collection('users').doc(uid).collection('expenses').doc(id).update(data);
    }

    async function deleteExpense(uid, id) {
        await db.collection('users').doc(uid).collection('expenses').doc(id).delete();
    }

    // ── Income ───────────────────────────────────────
    async function addIncome(uid, income) {
        const ref = await db.collection('users').doc(uid).collection('income').add({
            ...income,
            createdAt: Date.now()
        });
        return ref.id;
    }

    async function getIncome(uid) {
        const snap = await db.collection('users').doc(uid).collection('income')
            .orderBy('date', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function updateIncome(uid, id, data) {
        await db.collection('users').doc(uid).collection('income').doc(id).update(data);
    }

    async function deleteIncome(uid, id) {
        await db.collection('users').doc(uid).collection('income').doc(id).delete();
    }

    // ── Budgets ──────────────────────────────────────
    async function getBudgets(uid) {
        const doc = await db.collection('users').doc(uid).collection('budgets').doc('monthly').get();
        return doc.exists ? doc.data() : {};
    }

    async function setBudget(uid, category, amount) {
        await db.collection('users').doc(uid).collection('budgets').doc('monthly').set(
            { [category]: amount },
            { merge: true }
        );
    }

    async function deleteBudget(uid, category) {
        await db.collection('users').doc(uid).collection('budgets').doc('monthly').update({
            [category]: firebase.firestore.FieldValue.delete()
        });
    }

    // ── Custom Categories ────────────────────────────
    async function getCategorySettings(uid) {
        const doc = await db.collection('users').doc(uid).collection('settings').doc('categories').get();
        if (!doc.exists) return { list: [], hidden: [] };
        const data = doc.data();
        return { list: data.list || [], hidden: data.hidden || [] };
    }

    async function setCategorySettings(uid, list, hidden) {
        await db.collection('users').doc(uid).collection('settings').doc('categories').set({ list, hidden });
    }

    return {
        getProfile, setProfile,
        addExpense, getExpenses, updateExpense, deleteExpense,
        addIncome, getIncome, updateIncome, deleteIncome,
        getBudgets, setBudget, deleteBudget,
        getCategorySettings, setCategorySettings
    };
})();
