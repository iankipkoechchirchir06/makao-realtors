// Makao Realtors - Full Stack Application Server
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure session middleware
app.use(session({
    secret: 'makao-realtors-secret-key-10293847',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Body parser and static assets setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Kipkoech',
    database: 'makao_db'
};

let dbPool;

// Self-healing database initialization
async function initDatabase() {
    try {
        // Step 1: Connect without a database first to ensure database exists
        const initConnection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });
        
        await initConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
        await initConnection.end();
        console.log(`Database '${dbConfig.database}' ensured successfully.`);

        // Step 2: Establish pooled connection
        dbPool = mysql.createPool(dbConfig);

        // Step 3: Read and apply schema DDL from schema.sql
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            // Safely strip SQL comments before splitting queries to prevent filtering out table creators
            const cleanSql = schemaSql
                .split('\n')
                .map(line => {
                    const idx = line.indexOf('--');
                    return idx >= 0 ? line.substring(0, idx) : line;
                })
                .join('\n');

            const queries = cleanSql
                .split(';')
                .map(q => q.trim())
                .filter(q => q.length > 0);

            console.log("Applying schema.sql tables...");
            for (const q of queries) {
                await dbPool.query(q);
            }
            console.log("All tables successfully migrated.");
        }

        // Step 4: Seed pre-required Admin Account: 0115481162 / 12345
        const [admins] = await dbPool.query('SELECT * FROM users WHERE phone_number = ?', ['0115481162']);
        if (admins.length === 0) {
            const hash = await bcrypt.hash('12345', 10);
            await dbPool.query(
                `INSERT INTO users (phone_number, full_name, email, password_hash, role, status) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                ['0115481162', 'Makao Lead Admin', 'admin@makao.co.ke', hash, 'admin', 'active']
            );
            console.log("SUCCESS: Default Admin user pre-seeded: Phone '0115481162' Pass '12345'");
        }

        // Step 5: Seed test users for standard roles
        const seedRoles = [
            { phone: '0722222222', name: 'John Support Staff', role: 'staff', email: 'staff@makao.co.ke' },
            { phone: '0733333333', name: 'James Landlord', role: 'landlord', email: 'james@landlord.com' },
            { phone: '0744444444', name: 'Sarah Seller', role: 'seller', email: 'sarah@seller.com' },
            { phone: '0755555555', name: 'Robert Renter', role: 'renter', email: 'robert@renter.com' },
            { phone: '0766666666', name: 'Betty Buyer', role: 'buyer', email: 'betty@buyer.com' }
        ];

        for (const user of seedRoles) {
            const [exists] = await dbPool.query('SELECT * FROM users WHERE phone_number = ?', [user.phone]);
            if (exists.length === 0) {
                const hash = await bcrypt.hash('12345', 10);
                await dbPool.query(
                    `INSERT INTO users (phone_number, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
                    [user.phone, user.name, user.email, hash, user.role]
                );
            }
        }

        // Step 6: Seed property listings if database is empty
        const [listings] = await dbPool.query('SELECT * FROM listings');
        if (listings.length === 0) {
            const [[landlord]] = await dbPool.query('SELECT id FROM users WHERE role = "landlord" LIMIT 1');
            const [[seller]] = await dbPool.query('SELECT id FROM users WHERE role = "seller" LIMIT 1');

            if (landlord && seller) {
                // Seed Landlord Apartment with sub-rooms
                const [insApartment] = await dbPool.query(
                    `INSERT INTO listings (title, description, price, property_type, role_type, owner_id, amenities, images, availability, has_multiple_rooms) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'Kilimani Heights Apartments', 
                        'Stunning modern apartment block in Kilimani. Fully furnished bedsitters and single rooms available. Free high-speed Wi-Fi, elevator service, solar backup hot water, and 24/7 security guarding.',
                        15000.00,
                        'apartment',
                        'landlord',
                        landlord.id,
                        'Elevator, Solar Hot Water, Wi-Fi, Security Guard, Balcony',
                        '/images/kilimani_heights.jpg',
                        'available',
                        true
                    ]
                );

                const listingId = insApartment.insertId;
                await dbPool.query(
                    `INSERT INTO apartment_rooms (listing_id, room_number_or_name, price, availability) VALUES 
                     (?, 'Unit A-01 (Bedsitter)', 12000.00, 'available'),
                     (?, 'Unit B-03 (1 Bedroom)', 18000.00, 'available')`,
                    [listingId, listingId]
                );

                // Seed Seller Luxury Villa
                await dbPool.query(
                    `INSERT INTO listings (title, description, price, property_type, role_type, owner_id, amenities, images, availability, has_multiple_rooms) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'Karen Green Valley Villa',
                        'Exclusive 4-Bedroom executive mansion in the leafy Karen suburbs. Has a landscaped private garden, personal solar-heated swimming pool, electric double fencing security perimeter, domestic quarters, and a locking car garage.',
                        25000000.00,
                        'house',
                        'seller',
                        seller.id,
                        'Swimming Pool, Private Garden, Garage, Electric Fencing, Guest House',
                        '/images/karen_villa.jpg',
                        'available',
                        false
                    ]
                );
                
                // Seed mock payments
                await dbPool.query(
                    `INSERT INTO payments (user_id, payment_type, amount, mpesa_receipt, phone_number, status) VALUES
                     (?, 'listing_fee', 100.00, 'MPESALISTING1', '0733333333', 'approved'),
                     (?, 'listing_fee', 100.00, 'MPESALISTING2', '0744444444', 'approved')`,
                    [landlord.id, seller.id]
                );
                
                console.log("SUCCESS: Seeding initial property records completed.");
            }
        }

    } catch (err) {
        console.error("FATAL DATABASE ERROR:", err.message);
        console.warn("Please ensure your local MySQL server is running and configure connection settings.");
    }
}

initDatabase();

// Global variables for templates
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.theme = req.session.theme || 'light';
    next();
});

// Middleware Route Authentication Guards
function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        if (req.session.user.status === 'suspended') {
            return res.status(403).send("Your account has been suspended by an administrator.");
        }
        if (!roles.includes(req.session.user.role)) {
            return res.status(403).send("Unauthorized Access: Insufficient Privileges.");
        }
        next();
    };
}

// ----------------------------------------------------
// PUBLIC ROUTES (BEFORE LOGIN)
// ----------------------------------------------------

// GET: Landing page - browsing properties
app.get('/', async (req, res) => {
    try {
        const { search = '', type = '', price = '' } = req.query;
        let query = `
            SELECT l.*, u.full_name as owner_name, u.phone_number as owner_phone 
            FROM listings l 
            JOIN users u ON l.owner_id = u.id 
            WHERE l.availability = 'available'
        `;
        const params = [];

        if (search) {
            query += ' AND (l.title LIKE ? OR l.description LIKE ? OR l.amenities LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (type) {
            query += ' AND l.property_type = ?';
            params.push(type);
        }
        if (price) {
            const maxVal = parseFloat(price);
            if (!isNaN(maxVal)) {
                query += ' AND l.price <= ?';
                params.push(maxVal);
            }
        }

        query += ' ORDER BY l.id DESC';
        const [listings] = await dbPool.query(query, params);
        
        // Fetch room count for apartments
        for (const item of listings) {
            if (item.has_multiple_rooms) {
                const [[rCount]] = await dbPool.query('SELECT COUNT(*) as count FROM apartment_rooms WHERE listing_id = ?', [item.id]);
                item.room_count = rCount.count;
            }
        }

        res.render('landing', { listings, search, type, price });
    } catch (err) {
        console.error(err);
        res.render('landing', { listings: [], search: '', type: '', price: '', error: 'Database loading failure.' });
    }
});

// GET: Login view
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect(`/${req.session.user.role}/dashboard`);
    }
    res.render('login', { error: null });
});

// POST: Login processing
app.post('/login', async (req, res) => {
    const { phone_number, password } = req.body;
    try {
        const [rows] = await dbPool.query('SELECT * FROM users WHERE phone_number = ?', [phone_number]);
        if (rows.length === 0) {
            return res.render('login', { error: 'Invalid credentials: Phone number not registered.' });
        }
        
        const user = rows[0];
        if (user.status === 'suspended') {
            return res.render('login', { error: 'Suspended: This account has been deactivated by administration.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.render('login', { error: 'Invalid password. Please try again.' });
        }

        // Store user in session
        req.session.user = {
            id: user.id,
            phone_number: user.phone_number,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            status: user.status
        };

        res.redirect(`/${user.role}/dashboard`);
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'System connection error. Please try later.' });
    }
});

// GET: Sign-up view
app.get('/signup', (req, res) => {
    if (req.session.user) {
        return res.redirect(`/${req.session.user.role}/dashboard`);
    }
    res.render('signup', { error: null });
});

// POST: Register public user roles
app.post('/signup', async (req, res) => {
    const { full_name, phone_number, email, password, confirm_password, role } = req.body;

    if (password !== confirm_password) {
        return res.render('signup', { error: 'Passwords do not match.' });
    }

    if (!['landlord', 'seller', 'renter', 'buyer'].includes(role)) {
        return res.render('signup', { error: 'Invalid role selection.' });
    }

    try {
        const [exists] = await dbPool.query('SELECT * FROM users WHERE phone_number = ?', [phone_number]);
        if (exists.length > 0) {
            return res.render('signup', { error: 'Phone number already registered.' });
        }

        const hash = await bcrypt.hash(password, 10);
        await dbPool.query(
            `INSERT INTO users (phone_number, full_name, email, password_hash, role) 
             VALUES (?, ?, ?, ?, ?)`,
            [phone_number, full_name, email || null, hash, role]
        );

        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.render('signup', { error: 'Register system failure.' });
    }
});

// GET: Terminate session
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ----------------------------------------------------
// PAYMENT (M-PESA SIMULATION EXPRESS)
// ----------------------------------------------------

app.post('/payment/mpesa-express', requireLogin, async (req, res) => {
    const { phone_number, amount, payment_type, listing_id, pin } = req.body;
    const userId = req.session.user.id;

    try {
        // Validation check
        if (!phone_number || !amount || !payment_type) {
            return res.status(400).json({ success: false, message: 'Missing parameters.' });
        }

        // Simulate M-Pesa error for PIN '0000'
        if (pin === '0000') {
            await dbPool.query(
                `INSERT INTO payments (user_id, listing_id, payment_type, amount, phone_number, status) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, listing_id || null, payment_type, amount, phone_number, 'rejected']
            );
            return res.json({ success: false, message: 'Transaction Declined: M-Pesa PIN Incorrect (0000).' });
        }

        // Create M-Pesa mock receipt
        const receiptCode = 'MPX' + Math.random().toString(36).substring(2, 9).toUpperCase();

        await dbPool.query(
            `INSERT INTO payments (user_id, listing_id, payment_type, amount, mpesa_receipt, phone_number, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, listing_id || null, payment_type, amount, receiptCode, phone_number, 'pending']
        );

        res.json({ success: true, message: 'STK push approved. Verification code issued.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'M-Pesa simulator malfunctioned.' });
    }
});

// ----------------------------------------------------
// SHARED SETTINGS VIEW HANDLERS
// ----------------------------------------------------

app.get('/settings/profile', requireLogin, async (req, res) => {
    try {
        const [[profile]] = await dbPool.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        res.render('settings/profile', { profile, success: null, error: null });
    } catch (err) {
        res.status(500).send("Settings error.");
    }
});

app.post('/settings/profile', requireLogin, async (req, res) => {
    const { full_name, email, phone_number } = req.body;
    try {
        await dbPool.query(
            'UPDATE users SET full_name = ?, email = ?, phone_number = ? WHERE id = ?',
            [full_name, email, phone_number, req.session.user.id]
        );
        req.session.user.full_name = full_name;
        req.session.user.email = email;
        req.session.user.phone_number = phone_number;

        const [[profile]] = await dbPool.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        res.render('settings/profile', { profile, success: 'Profile details updated successfully.', error: null });
    } catch (err) {
        const [[profile]] = await dbPool.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        res.render('settings/profile', { profile, success: null, error: 'Database update failed.' });
    }
});

app.post('/settings/password', requireLogin, async (req, res) => {
    const { current_password, new_password } = req.body;
    try {
        const [[user]] = await dbPool.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        const match = await bcrypt.compare(current_password, user.password_hash);
        if (!match) {
            return res.render('settings/profile', { profile: user, success: null, error: 'Current password incorrect.' });
        }

        const newHash = await bcrypt.hash(new_password, 10);
        await dbPool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.session.user.id]);
        res.render('settings/profile', { profile: user, success: 'Password changed successfully.', error: null });
    } catch (err) {
        res.status(500).send("Error switching password.");
    }
});

app.post('/settings/theme', requireLogin, (req, res) => {
    const { theme } = req.body;
    if (['light', 'dark'].includes(theme)) {
        req.session.theme = theme;
        return res.json({ success: true });
    }
    res.json({ success: false });
});

// ----------------------------------------------------
// ADMIN CONTROLLERS
// ----------------------------------------------------

app.get('/admin/dashboard', requireRole(['admin']), async (req, res) => {
    try {
        const [[userCount]] = await dbPool.query('SELECT COUNT(*) as count FROM users');
        const [[listCount]] = await dbPool.query('SELECT COUNT(*) as count FROM listings');
        const [[payCount]] = await dbPool.query('SELECT SUM(amount) as total FROM payments WHERE status = "approved"');
        const [users] = await dbPool.query('SELECT id, phone_number, full_name, role, status, balance FROM users ORDER BY id DESC');

        res.render('admin/dashboard', {
            stats: {
                users: userCount.count,
                listings: listCount.count,
                revenue: payCount.total || 0.00
            },
            users
        });
    } catch (err) {
        console.error(err);
        res.send("Dashboard loading error.");
    }
});

app.get('/admin/users', requireRole(['admin']), async (req, res) => {
    try {
        const [users] = await dbPool.query('SELECT * FROM users WHERE role IN ("admin", "staff")');
        res.render('admin/users', { users, success: null, error: null });
    } catch (err) {
        res.send("Users dashboard error.");
    }
});

app.post('/admin/users/create', requireRole(['admin']), async (req, res) => {
    const { full_name, phone_number, email, password, role } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        await dbPool.query(
            'INSERT INTO users (phone_number, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [phone_number, full_name, email || null, hash, role]
        );
        const [users] = await dbPool.query('SELECT * FROM users WHERE role IN ("admin", "staff")');
        res.render('admin/users', { users, success: 'Internal support user created successfully.', error: null });
    } catch (err) {
        const [users] = await dbPool.query('SELECT * FROM users WHERE role IN ("admin", "staff")');
        res.render('admin/users', { users, success: null, error: 'User registration failed: Phone unique limit.' });
    }
});

app.post('/admin/users/suspend', requireRole(['admin']), async (req, res) => {
    const { userId, status } = req.body;
    try {
        await dbPool.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
        res.redirect('/admin/dashboard');
    } catch (err) {
        res.send("Suspend action error.");
    }
});

app.get('/admin/listings', requireRole(['admin']), async (req, res) => {
    try {
        const [listings] = await dbPool.query(
            `SELECT l.*, u.full_name as owner_name FROM listings l 
             JOIN users u ON l.owner_id = u.id`
        );
        res.render('admin/listings', { listings });
    } catch (err) {
        res.send("Listings load failure.");
    }
});

app.get('/admin/broadcast', requireRole(['admin']), async (req, res) => {
    try {
        const [broadcasts] = await dbPool.query(
            `SELECT b.*, u.full_name as sender_name FROM broadcasts b
             JOIN users u ON b.sender_id = u.id ORDER BY b.id DESC`
        );
        res.render('admin/broadcast', { broadcasts, success: null });
    } catch (err) {
        res.send("Broadcast dashboard error.");
    }
});

app.post('/admin/broadcast', requireRole(['admin']), async (req, res) => {
    const { target_role, title, message } = req.body;
    try {
        await dbPool.query(
            'INSERT INTO broadcasts (sender_id, target_role, title, message) VALUES (?, ?, ?, ?)',
            [req.session.user.id, target_role, title, message]
        );
        const [broadcasts] = await dbPool.query(
            `SELECT b.*, u.full_name as sender_name FROM broadcasts b
             JOIN users u ON b.sender_id = u.id ORDER BY b.id DESC`
        );
        res.render('admin/broadcast', { broadcasts, success: 'Announcement broadcasted successfully.' });
    } catch (err) {
        res.send("Broadcast submission failed.");
    }
});

app.get('/admin/messages', requireRole(['admin']), async (req, res) => {
    try {
        // Fetch active chats with normal clients (excluding admin/staff roles)
        const [chatUsers] = await dbPool.query(
            'SELECT DISTINCT u.id, u.full_name, u.phone_number, u.role FROM users u JOIN support_messages m ON (u.id = m.sender_id OR u.id = m.receiver_id) WHERE u.role NOT IN ("admin", "staff")'
        );
        res.render('admin/messages', { chatUsers, chatMessages: [], selectedUser: null });
    } catch (err) {
        res.send("Chat load error.");
    }
});

app.get('/admin/messages/chat/:userId', requireRole(['admin']), async (req, res) => {
    const selectedUserId = req.params.userId;
    try {
        const [chatUsers] = await dbPool.query(
            'SELECT DISTINCT u.id, u.full_name, u.phone_number, u.role FROM users u JOIN support_messages m ON (u.id = m.sender_id OR u.id = m.receiver_id) WHERE u.role NOT IN ("admin", "staff")'
        );
        const [[selectedUser]] = await dbPool.query('SELECT id, full_name, role FROM users WHERE id = ?', [selectedUserId]);

        const [chatMessages] = await dbPool.query(
            `SELECT * FROM support_messages 
             WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
             ORDER BY id ASC`,
            [req.session.user.id, selectedUserId, selectedUserId, req.session.user.id]
        );

        res.render('admin/messages', { chatUsers, chatMessages, selectedUser });
    } catch (err) {
        res.send("Loading conversation failed.");
    }
});

app.post('/admin/messages/send', requireRole(['admin']), async (req, res) => {
    const { receiver_id, message } = req.body;
    try {
        await dbPool.query(
            'INSERT INTO support_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
            [req.session.user.id, receiver_id, message]
        );
        res.redirect(`/admin/messages/chat/${receiver_id}`);
    } catch (err) {
        res.send("Error sending message.");
    }
});

// ----------------------------------------------------
// STAFF CONTROLLERS
// ----------------------------------------------------

app.get('/staff/dashboard', requireRole(['staff']), async (req, res) => {
    try {
        const [[pendingPaymentsCount]] = await dbPool.query('SELECT COUNT(*) as count FROM payments WHERE status = "pending"');
        const [[totalConnectionsCount]] = await dbPool.query('SELECT COUNT(*) as count FROM user_connections');
        const [listings] = await dbPool.query('SELECT l.*, u.full_name as owner_name FROM listings l JOIN users u ON l.owner_id = u.id ORDER BY l.id DESC LIMIT 5');

        res.render('staff/dashboard', {
            stats: {
                pending_payments: pendingPaymentsCount.count,
                active_connections: totalConnectionsCount.count
            },
            listings
        });
    } catch (err) {
        res.send("Staff dashboard error.");
    }
});

app.get('/staff/payments', requireRole(['staff']), async (req, res) => {
    try {
        const [pendingPayments] = await dbPool.query(
            `SELECT p.*, u.full_name as payer_name, u.role as payer_role, l.title as property_title 
             FROM payments p 
             JOIN users u ON p.user_id = u.id 
             LEFT JOIN listings l ON p.listing_id = l.id 
             WHERE p.status = 'pending' ORDER BY p.id ASC`
        );
        res.render('staff/payments', { payments: pendingPayments });
    } catch (err) {
        res.send("Payments queue loading error.");
    }
});

app.post('/staff/payments/approve', requireRole(['staff']), async (req, res) => {
    const { payment_id } = req.body;
    const staffId = req.session.user.id;
    try {
        const [[payment]] = await dbPool.query('SELECT * FROM payments WHERE id = ?', [payment_id]);
        if (!payment) return res.send("Payment ID invalid.");

        // Update payment status
        await dbPool.query('UPDATE payments SET status = "approved", approved_by = ? WHERE id = ?', [staffId, payment_id]);
        
        // Add payment amount to platform balance logic
        await dbPool.query('UPDATE users SET balance = balance + ? WHERE role = "admin" LIMIT 1', [payment.amount]);

        // Connect user logic for connection fees
        if (payment.payment_type === 'connection_fee') {
            const [[listing]] = await dbPool.query('SELECT * FROM listings WHERE id = ?', [payment.listing_id]);
            if (listing) {
                // Insert standard connection record
                await dbPool.query(
                    `INSERT INTO user_connections (renter_or_buyer_id, listing_id, landlord_or_seller_id, payment_id) 
                     VALUES (?, ?, ?, ?)`,
                    [payment.user_id, payment.listing_id, listing.owner_id, payment_id]
                );
            }
        }

        res.redirect('/staff/payments');
    } catch (err) {
        console.error(err);
        res.send("Approving payment failed.");
    }
});

app.post('/staff/payments/reject', requireRole(['staff']), async (req, res) => {
    const { payment_id } = req.body;
    const staffId = req.session.user.id;
    try {
        await dbPool.query('UPDATE payments SET status = "rejected", approved_by = ? WHERE id = ?', [staffId, payment_id]);
        res.redirect('/staff/payments');
    } catch (err) {
        res.send("Payment rejection failed.");
    }
});

app.get('/staff/connections', requireRole(['staff']), async (req, res) => {
    try {
        const [connections] = await dbPool.query(
            `SELECT c.*, 
                    rb.full_name as client_name, rb.phone_number as client_phone, rb.role as client_role,
                    ls.full_name as owner_name, ls.phone_number as owner_phone,
                    l.title as listing_title, p.amount as amount_paid, p.mpesa_receipt
             FROM user_connections c
             JOIN users rb ON c.renter_or_buyer_id = rb.id
             JOIN users ls ON c.landlord_or_seller_id = ls.id
             JOIN listings l ON c.listing_id = l.id
             JOIN payments p ON c.payment_id = p.id
             ORDER BY c.id DESC`
        );
        res.render('staff/connections', { connections });
    } catch (err) {
        res.send("Connections query error.");
    }
});

app.get('/staff/notifications', requireRole(['staff']), async (req, res) => {
    try {
        const [broadcasts] = await dbPool.query(
            `SELECT b.*, u.full_name as sender_name FROM broadcasts b
             JOIN users u ON b.sender_id = u.id 
             WHERE b.target_role IN ("all", "staff") ORDER BY b.id DESC`
        );
        res.render('staff/notifications', { broadcasts });
    } catch (err) {
        res.send("Alerts error.");
    }
});

app.get('/staff/messages', requireRole(['staff']), async (req, res) => {
    try {
        const [chatUsers] = await dbPool.query(
            'SELECT DISTINCT u.id, u.full_name, u.phone_number, u.role FROM users u JOIN support_messages m ON (u.id = m.sender_id OR u.id = m.receiver_id) WHERE u.role NOT IN ("admin", "staff")'
        );
        res.render('staff/messages', { chatUsers, chatMessages: [], selectedUser: null });
    } catch (err) {
        res.send("Support inbox error.");
    }
});

app.get('/staff/messages/chat/:userId', requireRole(['staff']), async (req, res) => {
    const selectedUserId = req.params.userId;
    try {
        const [chatUsers] = await dbPool.query(
            'SELECT DISTINCT u.id, u.full_name, u.phone_number, u.role FROM users u JOIN support_messages m ON (u.id = m.sender_id OR u.id = m.receiver_id) WHERE u.role NOT IN ("admin", "staff")'
        );
        const [[selectedUser]] = await dbPool.query('SELECT id, full_name, role FROM users WHERE id = ?', [selectedUserId]);

        const [chatMessages] = await dbPool.query(
            `SELECT * FROM support_messages 
             WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
             ORDER BY id ASC`,
            [req.session.user.id, selectedUserId, selectedUserId, req.session.user.id]
        );

        res.render('staff/messages', { chatUsers, chatMessages, selectedUser });
    } catch (err) {
        res.send("Chat connection error.");
    }
});

app.post('/staff/messages/send', requireRole(['staff']), async (req, res) => {
    const { receiver_id, message } = req.body;
    try {
        await dbPool.query(
            'INSERT INTO support_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
            [req.session.user.id, receiver_id, message]
        );
        res.redirect(`/staff/messages/chat/${receiver_id}`);
    } catch (err) {
        res.send("Error posting chat message.");
    }
});

// ----------------------------------------------------
// LANDLORD CONTROLLERS
// ----------------------------------------------------

app.get('/landlord/dashboard', requireRole(['landlord']), async (req, res) => {
    const userId = req.session.user.id;
    try {
        const [listings] = await dbPool.query('SELECT * FROM listings WHERE owner_id = ? ORDER BY id DESC', [userId]);
        
        // Match each listing with listing fee payment status
        for (const item of listings) {
            const [[payment]] = await dbPool.query(
                'SELECT status FROM payments WHERE user_id = ? AND listing_id = ? AND payment_type = "listing_fee" ORDER BY id DESC LIMIT 1',
                [userId, item.id]
            );
            item.payment_status = payment ? payment.status : 'unpaid';
        }

        res.render('landlord/dashboard', { listings });
    } catch (err) {
        res.send("Landlord dashboard error.");
    }
});

app.get('/landlord/create', requireRole(['landlord']), (req, res) => {
    res.render('landlord/create', { error: null });
});

app.post('/landlord/create', requireRole(['landlord']), async (req, res) => {
    const { title, description, price, amenities, has_multiple_rooms, room_names, room_prices } = req.body;
    const userId = req.session.user.id;
    const hasRooms = has_multiple_rooms === 'on';

    try {
        // Upload images logic (max 5 for free plan simulated)
        const imagePaths = '/images/kilimani_heights.jpg'; // Seeding demo paths

        const [listing] = await dbPool.query(
            `INSERT INTO listings (title, description, price, property_type, role_type, owner_id, amenities, images, availability, has_multiple_rooms) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, price, 'apartment', 'landlord', userId, amenities, imagePaths, 'available', hasRooms]
        );

        const listingId = listing.insertId;

        // Sub-rooms logic
        if (hasRooms && room_names && room_prices) {
            for (let i = 0; i < room_names.length; i++) {
                if (room_names[i] && room_prices[i]) {
                    await dbPool.query(
                        'INSERT INTO apartment_rooms (listing_id, room_number_or_name, price) VALUES (?, ?, ?)',
                        [listingId, room_names[i], room_prices[i]]
                    );
                }
            }
        }

        res.redirect('/landlord/dashboard');
    } catch (err) {
        console.error(err);
        res.render('landlord/create', { error: 'Database saving error.' });
    }
});

app.post('/landlord/listings/availability', requireRole(['landlord']), async (req, res) => {
    const { listing_id, availability } = req.body;
    try {
        await dbPool.query('UPDATE listings SET availability = ? WHERE id = ? AND owner_id = ?', [availability, listing_id, req.session.user.id]);
        res.redirect('/landlord/dashboard');
    } catch (err) {
        res.send("Availability change failed.");
    }
});

app.get('/landlord/payments', requireRole(['landlord']), async (req, res) => {
    try {
        const [payments] = await dbPool.query(
            `SELECT p.*, l.title as property_title 
             FROM payments p 
             LEFT JOIN listings l ON p.listing_id = l.id 
             WHERE p.user_id = ? ORDER BY p.id DESC`,
            [req.session.user.id]
        );
        res.render('landlord/payments', { payments });
    } catch (err) {
        res.send("Payments query error.");
    }
});

app.get('/landlord/support', requireRole(['landlord']), async (req, res) => {
    try {
        // Select an active support handler (Staff or Admin)
        const [[handler]] = await dbPool.query('SELECT id, full_name FROM users WHERE role = "staff" LIMIT 1');
        const receiverId = handler ? handler.id : 1; // Fallback to admin

        const [chatMessages] = await dbPool.query(
            `SELECT * FROM support_messages 
             WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
             ORDER BY id ASC`,
            [req.session.user.id, receiverId, receiverId, req.session.user.id]
        );

        res.render('landlord/support', { chatMessages, handler: handler || { full_name: 'Makao Admin' } });
    } catch (err) {
        res.send("Support error.");
    }
});

app.post('/landlord/support', requireRole(['landlord']), async (req, res) => {
    const { message } = req.body;
    try {
        const [[handler]] = await dbPool.query('SELECT id FROM users WHERE role = "staff" LIMIT 1');
        const receiverId = handler ? handler.id : 1;

        await dbPool.query(
            'INSERT INTO support_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
            [req.session.user.id, receiverId, message]
        );
        res.redirect('/landlord/support');
    } catch (err) {
        res.send("Support message failed.");
    }
});

app.get('/landlord/notifications', requireRole(['landlord']), async (req, res) => {
    try {
        const [broadcasts] = await dbPool.query(
            `SELECT b.*, u.full_name as sender_name FROM broadcasts b
             JOIN users u ON b.sender_id = u.id 
             WHERE b.target_role IN ("all", "landlord") ORDER BY b.id DESC`
        );
        res.render('landlord/notifications', { broadcasts });
    } catch (err) {
        res.send("Alerts error.");
    }
});

// ----------------------------------------------------
// SELLER CONTROLLERS
// ----------------------------------------------------

app.get('/seller/dashboard', requireRole(['seller']), async (req, res) => {
    const userId = req.session.user.id;
    try {
        const [listings] = await dbPool.query('SELECT * FROM listings WHERE owner_id = ? ORDER BY id DESC', [userId]);

        for (const item of listings) {
            const [[payment]] = await dbPool.query(
                'SELECT status FROM payments WHERE user_id = ? AND listing_id = ? AND payment_type = "listing_fee" ORDER BY id DESC LIMIT 1',
                [userId, item.id]
            );
            item.payment_status = payment ? payment.status : 'unpaid';
        }

        res.render('seller/dashboard', { listings });
    } catch (err) {
        res.send("Seller dashboard error.");
    }
});

app.get('/seller/create', requireRole(['seller']), (req, res) => {
    res.render('seller/create', { error: null });
});

app.post('/seller/create', requireRole(['seller']), async (req, res) => {
    const { title, description, price, amenities } = req.body;
    const userId = req.session.user.id;

    try {
        const imagePaths = '/images/karen_villa.jpg';

        await dbPool.query(
            `INSERT INTO listings (title, description, price, property_type, role_type, owner_id, amenities, images, availability) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, price, 'house', 'seller', userId, amenities, imagePaths, 'available']
        );

        res.redirect('/seller/dashboard');
    } catch (err) {
        res.render('seller/create', { error: 'Database loading failure.' });
    }
});

app.post('/seller/listings/availability', requireRole(['seller']), async (req, res) => {
    const { listing_id, availability } = req.body;
    try {
        await dbPool.query('UPDATE listings SET availability = ? WHERE id = ? AND owner_id = ?', [availability, listing_id, req.session.user.id]);
        res.redirect('/seller/dashboard');
    } catch (err) {
        res.send("Availability change failed.");
    }
});

app.get('/seller/payments', requireRole(['seller']), async (req, res) => {
    try {
        const [payments] = await dbPool.query(
            `SELECT p.*, l.title as property_title 
             FROM payments p 
             LEFT JOIN listings l ON p.listing_id = l.id 
             WHERE p.user_id = ? ORDER BY p.id DESC`,
            [req.session.user.id]
        );
        res.render('seller/payments', { payments });
    } catch (err) {
        res.send("Payments query error.");
    }
});

app.get('/seller/support', requireRole(['seller']), async (req, res) => {
    try {
        const [[handler]] = await dbPool.query('SELECT id, full_name FROM users WHERE role = "staff" LIMIT 1');
        const receiverId = handler ? handler.id : 1;

        const [chatMessages] = await dbPool.query(
            `SELECT * FROM support_messages 
             WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
             ORDER BY id ASC`,
            [req.session.user.id, receiverId, receiverId, req.session.user.id]
        );

        res.render('seller/support', { chatMessages, handler: handler || { full_name: 'Makao Admin' } });
    } catch (err) {
        res.send("Support chat error.");
    }
});

app.post('/seller/support', requireRole(['seller']), async (req, res) => {
    const { message } = req.body;
    try {
        const [[handler]] = await dbPool.query('SELECT id FROM users WHERE role = "staff" LIMIT 1');
        const receiverId = handler ? handler.id : 1;

        await dbPool.query(
            'INSERT INTO support_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
            [req.session.user.id, receiverId, message]
        );
        res.redirect('/seller/support');
    } catch (err) {
        res.send("Error posting chat message.");
    }
});

app.get('/seller/notifications', requireRole(['seller']), async (req, res) => {
    try {
        const [broadcasts] = await dbPool.query(
            `SELECT b.*, u.full_name as sender_name FROM broadcasts b
             JOIN users u ON b.sender_id = u.id 
             WHERE b.target_role IN ("all", "seller") ORDER BY b.id DESC`
        );
        res.render('seller/notifications', { broadcasts });
    } catch (err) {
        res.send("Alerts loading error.");
    }
});

// ----------------------------------------------------
// BUYER CONTROLLERS
// ----------------------------------------------------

app.get('/buyer/dashboard', requireRole(['buyer']), async (req, res) => {
    try {
        // Browse active house listings listed by sellers
        const [listings] = await dbPool.query(
            `SELECT l.*, u.full_name as owner_name 
             FROM listings l 
             JOIN users u ON l.owner_id = u.id 
             WHERE l.role_type = 'seller' AND l.availability = 'available' ORDER BY l.id DESC`
        );

        // Map liked and saved properties
        for (const item of listings) {
            const [[liked]] = await dbPool.query(
                'SELECT id FROM user_interactions WHERE user_id = ? AND listing_id = ? AND interaction_type = "like"',
                [req.session.user.id, item.id]
            );
            const [[saved]] = await dbPool.query(
                'SELECT id FROM user_interactions WHERE user_id = ? AND listing_id = ? AND interaction_type = "save"',
                [req.session.user.id, item.id]
            );
            item.is_liked = !!liked;
            item.is_saved = !!saved;
            
            // Check connection/unlock fee status
            const [[payment]] = await dbPool.query(
                'SELECT status FROM payments WHERE user_id = ? AND listing_id = ? AND payment_type = "connection_fee" ORDER BY id DESC LIMIT 1',
                [req.session.user.id, item.id]
            );
            item.connection_status = payment ? payment.status : 'unpaid';
        }

        res.render('buyer/dashboard', { listings });
    } catch (err) {
        res.send("Buyer listings error.");
    }
});

app.get('/buyer/listings', requireRole(['buyer']), async (req, res) => {
    const userId = req.session.user.id;
    try {
        // Unlocked properties/Connections (Approved Payments)
        const [connections] = await dbPool.query(
            `SELECT c.*, 
                    l.title as listing_title, l.description, l.price, l.property_type, l.amenities, l.images,
                    u.full_name as owner_name, u.phone_number as owner_phone, u.email as owner_email
             FROM user_connections c
             JOIN listings l ON c.listing_id = l.id
             JOIN users u ON c.landlord_or_seller_id = u.id
             WHERE c.renter_or_buyer_id = ?`,
            [userId]
        );

        // Liked and Saved properties
        const [savedListings] = await dbPool.query(
            `SELECT l.*, ui.interaction_type, u.full_name as owner_name
             FROM user_interactions ui
             JOIN listings l ON ui.listing_id = l.id
             JOIN users u ON l.owner_id = u.id
             WHERE ui.user_id = ?`,
            [userId]
        );

        res.render('buyer/listings', { connections, savedListings });
    } catch (err) {
        res.send("My Listings dashboard error.");
    }
});

app.post('/buyer/interactions', requireRole(['buyer']), async (req, res) => {
    const { listing_id, interaction_type } = req.body;
    const userId = req.session.user.id;
    try {
        const [exists] = await dbPool.query(
            'SELECT id FROM user_interactions WHERE user_id = ? AND listing_id = ? AND interaction_type = ?',
            [userId, listing_id, interaction_type]
        );
        if (exists.length > 0) {
            // Delete interaction if clicked again
            await dbPool.query(
                'DELETE FROM user_interactions WHERE user_id = ? AND listing_id = ? AND interaction_type = ?',
                [userId, listing_id, interaction_type]
            );
        } else {
            await dbPool.query(
                'INSERT INTO user_interactions (user_id, listing_id, interaction_type) VALUES (?, ?, ?)',
                [userId, listing_id, interaction_type]
            );
        }
        res.redirect('/buyer/dashboard');
    } catch (err) {
        res.send("Interaction click failed.");
    }
});

app.get('/buyer/payments', requireRole(['buyer']), async (req, res) => {
    try {
        const [payments] = await dbPool.query(
            `SELECT p.*, l.title as property_title 
             FROM payments p 
             LEFT JOIN listings l ON p.listing_id = l.id 
             WHERE p.user_id = ? AND p.payment_type = 'connection_fee' ORDER BY p.id DESC`,
            [req.session.user.id]
        );
        res.render('buyer/payments', { payments });
    } catch (err) {
        res.send("Payments query error.");
    }
});

app.get('/buyer/support', requireRole(['buyer']), async (req, res) => {
    try {
        const [[handler]] = await dbPool.query('SELECT id, full_name FROM users WHERE role = "staff" LIMIT 1');
        const receiverId = handler ? handler.id : 1;

        const [chatMessages] = await dbPool.query(
            `SELECT * FROM support_messages 
             WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
             ORDER BY id ASC`,
            [req.session.user.id, receiverId, receiverId, req.session.user.id]
        );

        res.render('buyer/support', { chatMessages, handler: handler || { full_name: 'Makao Admin' } });
    } catch (err) {
        res.send("Support error.");
    }
});

app.post('/buyer/support', requireRole(['buyer']), async (req, res) => {
    const { message } = req.body;
    try {
        const [[handler]] = await dbPool.query('SELECT id FROM users WHERE role = "staff" LIMIT 1');
        const receiverId = handler ? handler.id : 1;

        await dbPool.query(
            'INSERT INTO support_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
            [req.session.user.id, receiverId, message]
        );
        res.redirect('/buyer/support');
    } catch (err) {
        res.send("Message sending error.");
    }
});

app.get('/buyer/notifications', requireRole(['buyer']), async (req, res) => {
    try {
        const [broadcasts] = await dbPool.query(
            `SELECT b.*, u.full_name as sender_name FROM broadcasts b
             JOIN users u ON b.sender_id = u.id 
             WHERE b.target_role IN ("all", "buyer") ORDER BY b.id DESC`
        );
        res.render('buyer/notifications', { broadcasts });
    } catch (err) {
        res.send("Alerts error.");
    }
});

// ----------------------------------------------------
// RENTER CONTROLLERS
// ----------------------------------------------------

app.get('/renter/dashboard', requireRole(['renter']), async (req, res) => {
    try {
        // Browse active apartment properties listed by landlords
        const [listings] = await dbPool.query(
            `SELECT l.*, u.full_name as owner_name 
             FROM listings l 
             JOIN users u ON l.owner_id = u.id 
             WHERE l.role_type = 'landlord' AND l.availability = 'available' ORDER BY l.id DESC`
        );

        for (const item of listings) {
            const [[liked]] = await dbPool.query(
                'SELECT id FROM user_interactions WHERE user_id = ? AND listing_id = ? AND interaction_type = "like"',
                [req.session.user.id, item.id]
            );
            const [[saved]] = await dbPool.query(
                'SELECT id FROM user_interactions WHERE user_id = ? AND listing_id = ? AND interaction_type = "save"',
                [req.session.user.id, item.id]
            );
            item.is_liked = !!liked;
            item.is_saved = !!saved;

            const [[payment]] = await dbPool.query(
                'SELECT status FROM payments WHERE user_id = ? AND listing_id = ? AND payment_type = "connection_fee" ORDER BY id DESC LIMIT 1',
                [req.session.user.id, item.id]
            );
            item.connection_status = payment ? payment.status : 'unpaid';

            if (item.has_multiple_rooms) {
                const [rooms] = await dbPool.query('SELECT * FROM apartment_rooms WHERE listing_id = ?', [item.id]);
                item.rooms = rooms;
            }
        }

        res.render('renter/dashboard', { listings });
    } catch (err) {
        res.send("Renter listings error.");
    }
});

app.get('/renter/listings', requireRole(['renter']), async (req, res) => {
    const userId = req.session.user.id;
    try {
        const [connections] = await dbPool.query(
            `SELECT c.*, 
                    l.title as listing_title, l.description, l.price, l.property_type, l.amenities, l.images,
                    u.full_name as owner_name, u.phone_number as owner_phone, u.email as owner_email
             FROM user_connections c
             JOIN listings l ON c.listing_id = l.id
             JOIN users u ON c.landlord_or_seller_id = u.id
             WHERE c.renter_or_buyer_id = ?`,
            [userId]
        );

        const [savedListings] = await dbPool.query(
            `SELECT l.*, ui.interaction_type, u.full_name as owner_name
             FROM user_interactions ui
             JOIN listings l ON ui.listing_id = l.id
             JOIN users u ON l.owner_id = u.id
             WHERE ui.user_id = ?`,
            [userId]
        );

        res.render('renter/listings', { connections, savedListings });
    } catch (err) {
        res.send("My Listings dashboard error.");
    }
});

app.post('/renter/interactions', requireRole(['renter']), async (req, res) => {
    const { listing_id, interaction_type } = req.body;
    const userId = req.session.user.id;
    try {
        const [exists] = await dbPool.query(
            'SELECT id FROM user_interactions WHERE user_id = ? AND listing_id = ? AND interaction_type = ?',
            [userId, listing_id, interaction_type]
        );
        if (exists.length > 0) {
            await dbPool.query(
                'DELETE FROM user_interactions WHERE user_id = ? AND listing_id = ? AND interaction_type = ?',
                [userId, listing_id, interaction_type]
            );
        } else {
            await dbPool.query(
                'INSERT INTO user_interactions (user_id, listing_id, interaction_type) VALUES (?, ?, ?)',
                [userId, listing_id, interaction_type]
            );
        }
        res.redirect('/renter/dashboard');
    } catch (err) {
        res.send("Interaction operation failed.");
    }
});

app.get('/renter/payments', requireRole(['renter']), async (req, res) => {
    try {
        const [payments] = await dbPool.query(
            `SELECT p.*, l.title as property_title 
             FROM payments p 
             LEFT JOIN listings l ON p.listing_id = l.id 
             WHERE p.user_id = ? AND p.payment_type = 'connection_fee' ORDER BY p.id DESC`,
            [req.session.user.id]
        );
        res.render('renter/payments', { payments });
    } catch (err) {
        res.send("Payments query error.");
    }
});

app.get('/renter/support', requireRole(['renter']), async (req, res) => {
    try {
        const [[handler]] = await dbPool.query('SELECT id, full_name FROM users WHERE role = "staff" LIMIT 1');
        const receiverId = handler ? handler.id : 1;

        const [chatMessages] = await dbPool.query(
            `SELECT * FROM support_messages 
             WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
             ORDER BY id ASC`,
            [req.session.user.id, receiverId, receiverId, req.session.user.id]
        );

        res.render('renter/support', { chatMessages, handler: handler || { full_name: 'Makao Admin' } });
    } catch (err) {
        res.send("Support error.");
    }
});

app.post('/renter/support', requireRole(['renter']), async (req, res) => {
    const { message } = req.body;
    try {
        const [[handler]] = await dbPool.query('SELECT id FROM users WHERE role = "staff" LIMIT 1');
        const receiverId = handler ? handler.id : 1;

        await dbPool.query(
            'INSERT INTO support_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
            [req.session.user.id, receiverId, message]
        );
        res.redirect('/renter/support');
    } catch (err) {
        res.send("Message sending error.");
    }
});

app.get('/renter/notifications', requireRole(['renter']), async (req, res) => {
    try {
        const [broadcasts] = await dbPool.query(
            `SELECT b.*, u.full_name as sender_name FROM broadcasts b
             JOIN users u ON b.sender_id = u.id 
             WHERE b.target_role IN ("all", "renter") ORDER BY b.id DESC`
        );
        res.render('renter/notifications', { broadcasts });
    } catch (err) {
        res.send("Alerts loading error.");
    }
});

// Settings entry point redirect
app.get('/settings', requireLogin, (req, res) => {
    res.redirect('/settings/profile');
});

// Boot listening port
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`MAKAO REALTORS is live on http://localhost:${PORT}`);
    console.log(`====================================================`);
});
