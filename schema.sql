-- Makao Realtors Database Schema (MySQL Compatible)
CREATE DATABASE IF NOT EXISTS makao_db;
USE makao_db;
-- Drop tables if they exist to allow clean reseeding (order matters due to foreign keys)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS support_messages;
DROP TABLE IF EXISTS broadcasts;
DROP TABLE IF EXISTS user_connections;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS user_interactions;
DROP TABLE IF EXISTS apartment_rooms;
DROP TABLE IF EXISTS listings;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users Table (Admin, Staff, Landlord, Seller, Renter, Buyer)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff', 'landlord', 'seller', 'renter', 'buyer') NOT NULL,
    status ENUM('active', 'suspended') DEFAULT 'active',
    balance DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Property Listings Table
CREATE TABLE listings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL, -- Monthly rent (Landlord) or House price (Seller)
    property_type ENUM('apartment', 'house') NOT NULL,
    role_type ENUM('landlord', 'seller') NOT NULL,
    owner_id INT NOT NULL,
    amenities TEXT, -- Comma-separated or JSON list
    images TEXT, -- Semi-colon separated image file paths/URLs (Max 5 for free plan)
    availability ENUM('available', 'taken') DEFAULT 'available',
    has_multiple_rooms BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Apartment Rooms Table (Sub-units for Landlords)
CREATE TABLE apartment_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    listing_id INT NOT NULL,
    room_number_or_name VARCHAR(50) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    availability ENUM('available', 'taken') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. User Saved & Liked Listings
CREATE TABLE user_interactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    listing_id INT NOT NULL,
    interaction_type ENUM('like', 'save') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_interaction (user_id, listing_id, interaction_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Payments Table (M-Pesa checkout flows)
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    listing_id INT DEFAULT NULL,
    payment_type ENUM('listing_fee', 'connection_fee') NOT NULL, -- KES 100 or 10% fee
    amount DECIMAL(12, 2) NOT NULL,
    mpesa_receipt VARCHAR(50) UNIQUE NULL,
    phone_number VARCHAR(20) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Connections Table (When payment approved, unlocks landlord/seller phone info)
CREATE TABLE user_connections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    renter_or_buyer_id INT NOT NULL,
    listing_id INT NOT NULL,
    landlord_or_seller_id INT NOT NULL,
    payment_id INT NOT NULL,
    status ENUM('active', 'completed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (renter_or_buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    FOREIGN KEY (landlord_or_seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Broadcasts (Admins sending alerts)
CREATE TABLE broadcasts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    target_role ENUM('all', 'landlord', 'seller', 'renter', 'buyer', 'staff') NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Support Chat Messages
CREATE TABLE support_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the default administrator account.
INSERT INTO users (id, phone_number, full_name, email, password_hash, role, status)
VALUES (
    1,
    '0115481162',
    'Makao Lead Admin',
    'admin@makao.co.ke',
    '$2b$10$Hex1VFeX5G9JVUrCp3Jp9exIcuMqc9zccyW.TRLeynGTGZQQ3oRzu',
    'admin',
    'active'
);

-- Seed sample users for development and demonstration.
INSERT INTO users (id, phone_number, full_name, email, password_hash, role, status, balance)
VALUES
    (2, '0711000001', 'Amina Wanjiku', 'amina@example.com', '$2b$10$Hex1VFeX5G9JVUrCp3Jp9exIcuMqc9zccyW.TRLeynGTGZQQ3oRzu', 'staff', 'active', 1500.00),
    (3, '0711000002', 'Brian Otieno', 'brian@example.com', '$2b$10$Hex1VFeX5G9JVUrCp3Jp9exIcuMqc9zccyW.TRLeynGTGZQQ3oRzu', 'landlord', 'active', 4500.00),
    (4, '0711000003', 'Cynthia Njeri', 'cynthia@example.com', '$2b$10$Hex1VFeX5G9JVUrCp3Jp9exIcuMqc9zccyW.TRLeynGTGZQQ3oRzu', 'landlord', 'active', 3200.00),
    (5, '0711000004', 'David Mwangi', 'david@example.com', '$2b$10$Hex1VFeX5G9JVUrCp3Jp9exIcuMqc9zccyW.TRLeynGTGZQQ3oRzu', 'seller', 'active', 9800.00),
    (6, '0711000005', 'Esther Achieng', 'esther@example.com', '$2b$10$Hex1VFeX5G9JVUrCp3Jp9exIcuMqc9zccyW.TRLeynGTGZQQ3oRzu', 'seller', 'active', 7200.00),
    (7, '0711000006', 'Felix Kamau', 'felix@example.com', '$2b$10$Hex1VFeX5G9JVUrCp3Jp9exIcuMqc9zccyW.TRLeynGTGZQQ3oRzu', 'renter', 'active', 800.00),
    (8, '0711000007', 'Grace Wambui', 'grace@example.com', '$2b$10$Hex1VFeX5G9JVUrCp3Jp9exIcuMqc9zccyW.TRLeynGTGZQQ3oRzu', 'renter', 'active', 1250.00),
    (9, '0711000008', 'Hassan Ali', 'hassan@example.com', '$2b$10$Hex1VFeX5G9JVUrCp3Jp9exIcuMqc9zccyW.TRLeynGTGZQQ3oRzu', 'buyer', 'active', 25000.00),
    (10, '0711000009', 'Irene Chebet', 'irene@example.com', '$2b$10$Hex1VFeX5G9JVUrCp3Jp9exIcuMqc9zccyW.TRLeynGTGZQQ3oRzu', 'buyer', 'active', 18000.00);

-- Seed sample property listings.
INSERT INTO listings (id, title, description, price, property_type, role_type, owner_id, amenities, images, availability, has_multiple_rooms)
VALUES
    (1, 'Kilimani Modern Apartments', 'Bright one bedroom apartments near Yaya Centre.', 45000.00, 'apartment', 'landlord', 3, 'Parking,WiFi,Security', 'kilimani-1.jpg;kilimani-2.jpg', 'available', TRUE),
    (2, 'Westlands Furnished Flats', 'Furnished apartments suitable for professionals.', 65000.00, 'apartment', 'landlord', 3, 'Gym,Lift,Backup Generator', 'westlands-1.jpg;westlands-2.jpg', 'available', TRUE),
    (3, 'Ruaka Family Apartments', 'Quiet family apartments close to schools and shops.', 38000.00, 'apartment', 'landlord', 4, 'Parking,Playground,Water Backup', 'ruaka-1.jpg', 'available', TRUE),
    (4, 'South B Budget Rooms', 'Affordable and secure rooms for students and young workers.', 18000.00, 'apartment', 'landlord', 4, 'CCTV,Water Included,Internet', 'southb-1.jpg', 'available', TRUE),
    (5, 'Kileleshwa Executive Apartments', 'Spacious apartments in a quiet leafy neighborhood.', 85000.00, 'apartment', 'landlord', 3, 'Pool,Gym,Parking', 'kileleshwa-1.jpg;kileleshwa-2.jpg', 'available', TRUE),
    (6, 'Runda Family Home', 'Four bedroom family home on a secure compound.', 28500000.00, 'house', 'seller', 5, 'Garden,Garage,Servant Quarter', 'runda-1.jpg;runda-2.jpg', 'available', FALSE),
    (7, 'Karen Garden Villa', 'Spacious villa with mature gardens and a private drive.', 42000000.00, 'house', 'seller', 5, 'Garden,Pool,Garage,DSQ', 'karen-1.jpg;karen-2.jpg', 'available', FALSE),
    (8, 'Syokimau Starter Home', 'Modern three bedroom home near the commuter rail.', 12500000.00, 'house', 'seller', 6, 'Parking,Perimeter Wall,Water Tank', 'syokimau-1.jpg', 'available', FALSE),
    (9, 'Kitengela Townhouse', 'Contemporary townhouse in a gated community.', 9800000.00, 'house', 'seller', 6, 'Security,Parking,Clubhouse', 'kitengela-1.jpg;kitengela-2.jpg', 'taken', FALSE),
    (10, 'Lavington Townhouse', 'Elegant townhouse with excellent access to amenities.', 35000000.00, 'house', 'seller', 5, 'Garden,Garage,Security', 'lavington-1.jpg;lavington-2.jpg', 'available', FALSE);

-- Seed apartment rooms for multi-unit listings.
INSERT INTO apartment_rooms (id, listing_id, room_number_or_name, price, availability)
VALUES
    (1, 1, 'A101', 45000.00, 'available'),
    (2, 1, 'A102', 45000.00, 'taken'),
    (3, 2, 'B201', 65000.00, 'available'),
    (4, 2, 'B202', 68000.00, 'available'),
    (5, 3, 'C301', 38000.00, 'available'),
    (6, 3, 'C302', 40000.00, 'available'),
    (7, 4, 'D401', 18000.00, 'taken'),
    (8, 4, 'D402', 20000.00, 'available'),
    (9, 5, 'E501', 85000.00, 'available'),
    (10, 5, 'E502', 90000.00, 'available');

-- Seed saved and liked listings.
INSERT INTO user_interactions (id, user_id, listing_id, interaction_type)
VALUES
    (1, 7, 1, 'like'),
    (2, 7, 2, 'save'),
    (3, 8, 1, 'save'),
    (4, 8, 3, 'like'),
    (5, 9, 6, 'save'),
    (6, 9, 7, 'like'),
    (7, 10, 8, 'save'),
    (8, 10, 10, 'like'),
    (9, 7, 4, 'save'),
    (10, 8, 5, 'like');

-- Seed payment records in different workflow states.
INSERT INTO payments (id, user_id, listing_id, payment_type, amount, mpesa_receipt, phone_number, status, approved_by)
VALUES
    (1, 7, 1, 'connection_fee', 4500.00, 'RCP001MAKAO', '0711000006', 'approved', 1),
    (2, 8, 2, 'connection_fee', 6500.00, 'RCP002MAKAO', '0711000007', 'approved', 1),
    (3, 9, 6, 'connection_fee', 2850000.00, 'RCP003MAKAO', '0711000008', 'approved', 1),
    (4, 10, 7, 'connection_fee', 4200000.00, 'RCP004MAKAO', '0711000009', 'pending', NULL),
    (5, 7, 3, 'connection_fee', 3800.00, 'RCP005MAKAO', '0711000006', 'pending', NULL),
    (6, 8, 4, 'listing_fee', 100.00, 'RCP006MAKAO', '0711000007', 'approved', 1),
    (7, 9, 8, 'connection_fee', 1250000.00, 'RCP007MAKAO', '0711000008', 'rejected', 1),
    (8, 10, 10, 'connection_fee', 3500000.00, 'RCP008MAKAO', '0711000009', 'pending', NULL),
    (9, 7, 5, 'listing_fee', 100.00, 'RCP009MAKAO', '0711000006', 'approved', 1),
    (10, 8, 9, 'connection_fee', 980000.00, 'RCP010MAKAO', '0711000007', 'approved', 1);

-- Seed unlocked landlord and seller connections.
INSERT INTO user_connections (id, renter_or_buyer_id, listing_id, landlord_or_seller_id, payment_id, status)
VALUES
    (1, 7, 1, 3, 1, 'active'),
    (2, 8, 2, 3, 2, 'active'),
    (3, 9, 6, 5, 3, 'active'),
    (4, 10, 7, 5, 4, 'active'),
    (5, 7, 3, 4, 5, 'active'),
    (6, 8, 4, 4, 6, 'completed'),
    (7, 9, 8, 6, 7, 'completed'),
    (8, 10, 10, 5, 8, 'active'),
    (9, 7, 5, 3, 9, 'active'),
    (10, 8, 9, 6, 10, 'completed');

-- Seed administrator broadcasts.
INSERT INTO broadcasts (id, sender_id, target_role, title, message)
VALUES
    (1, 1, 'all', 'Welcome to Makao Realtors', 'Welcome to Makao Realtors. Keep your profile and listings up to date.'),
    (2, 1, 'landlord', 'Listing quality reminder', 'Please use clear photos and accurate pricing on every listing.'),
    (3, 1, 'seller', 'Property verification', 'Ensure ownership documents are ready before listing a property.'),
    (4, 1, 'renter', 'Viewing safety', 'Arrange property viewings during reasonable hours and share your plans.'),
    (5, 1, 'buyer', 'Buyer verification', 'Confirm property details and ownership before making a purchase decision.'),
    (6, 1, 'staff', 'Support queue update', 'Please review unresolved support conversations before end of day.'),
    (7, 1, 'all', 'Platform maintenance', 'Scheduled maintenance will take place this weekend.'),
    (8, 1, 'landlord', 'Room availability', 'Update room availability immediately after a successful booking.'),
    (9, 1, 'seller', 'Payment confirmation', 'Wait for payment approval before handing over access or documents.'),
    (10, 1, 'all', 'Customer care standards', 'Respond to enquiries promptly and respectfully.');

-- Seed support conversations.
INSERT INTO support_messages (id, sender_id, receiver_id, message, is_read)
VALUES
    (1, 7, 2, 'I need help arranging a viewing.', TRUE),
    (2, 2, 7, 'Please share the listing number and preferred viewing time.', TRUE),
    (3, 8, 2, 'How long does payment approval take?', FALSE),
    (4, 2, 8, 'Approved payments usually unlock the connection immediately.', TRUE),
    (5, 9, 2, 'Can I schedule a visit for the Runda home?', FALSE),
    (6, 2, 9, 'Yes, I have forwarded your request to the seller.', TRUE),
    (7, 10, 2, 'The listing photos do not load on my phone.', FALSE),
    (8, 2, 10, 'Thank you. We are checking the image links.', FALSE),
    (9, 3, 2, 'I have added two new rooms to my listing.', TRUE),
    (10, 2, 3, 'The rooms are visible and ready for enquiries.', TRUE);
