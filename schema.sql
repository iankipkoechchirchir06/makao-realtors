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
