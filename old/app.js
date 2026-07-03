// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    loadingScreen = document.getElementById('loading-screen');
    authScreen = document.getElementById('auth-screen');
    employeeDashboard = document.getElementById('employee-dashboard');
    adminDashboard = document.getElementById('admin-dashboard');
    
    // Initialize Supabase client
    if (window.supabase && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_URL') {
        try {
            supabaseClient = window.supabase.createClient(
                SUPABASE_CONFIG.url,
                SUPABASE_CONFIG.anonKey
            );
        } catch (e) {
            console.error('Failed to initialize Supabase:', e);
        }
    }
    
    await checkAuth();
    initializeEventListeners();
    startClock();
});
