// App State
let supabaseClient = null;
let currentUser = null;
let userProfile = null;
let currentClockIn = null;
let clockInterval = null;
let timeWorkedInterval = null;
let isClockBusy = false; // guards against rapid double-taps on clock in/out

// DOM Elements
let loadingScreen, authScreen, employeeDashboard, adminDashboard;
