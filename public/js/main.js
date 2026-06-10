// Makao Realtors - Client Side Script

document.addEventListener('DOMContentLoaded', () => {
    // 1. Password Visibility Toggle
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            if (targetInput) {
                const isPassword = targetInput.getAttribute('type') === 'password';
                targetInput.setAttribute('type', isPassword ? 'text' : 'password');
                
                // Toggle icon representation
                const icon = button.querySelector('i') || button;
                if (icon) {
                    if (isPassword) {
                        icon.classList.remove('fa-eye');
                        icon.classList.add('fa-eye-slash');
                        if (icon.tagName !== 'I') icon.textContent = 'Hide';
                    } else {
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                        if (icon.tagName !== 'I') icon.textContent = 'Show';
                    }
                }
            }
        });
    });

    // 2. Hamburger Mobile Drawer Menu & Animation (Pivots to 'X')
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (hamburgerBtn && mobileMenu) {
        hamburgerBtn.addEventListener('click', () => {
            hamburgerBtn.classList.toggle('active');
            mobileMenu.classList.toggle('open');
            
            // Toggle hamburger icon between ☰ and ✕ if no icons are used
            const iconSpan = hamburgerBtn.querySelector('.hamburger-icon');
            if (iconSpan) {
                if (hamburgerBtn.classList.contains('active')) {
                    iconSpan.innerHTML = '&times;'; // Cross character
                } else {
                    iconSpan.innerHTML = '&#9776;'; // Hamburger character
                }
            }
        });
    }

    // 3. Theme Toggle & Persistent Settings Storage
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        // Init theme from localStorage
        const savedTheme = localStorage.getItem('makao-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeToggleIcon(themeToggleBtn, savedTheme);

        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('makao-theme', newTheme);
            updateThemeToggleIcon(themeToggleBtn, newTheme);
            
            // Optional: submit to backend if logged in to persist in DB settings
            fetch('/settings/theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: newTheme })
            }).catch(err => console.log('Theme sync omitted or offline'));
        });
    }

    function updateThemeToggleIcon(btn, theme) {
        const icon = btn.querySelector('i') || btn;
        if (icon) {
            if (theme === 'dark') {
                icon.className = 'fas fa-sun';
                if (btn.tagName !== 'I') btn.title = 'Switch to Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                if (btn.tagName !== 'I') btn.title = 'Switch to Dark Mode';
            }
        }
    }

    // 4. Dynamic Apartment Room Adder for Landlords
    const hasMultipleRoomsCheckbox = document.getElementById('has_multiple_rooms');
    const roomsWrapper = document.getElementById('rooms-section-wrapper');
    const addRoomBtn = document.getElementById('add-room-field-btn');
    const roomsListContainer = document.getElementById('rooms-fields-list');

    if (hasMultipleRoomsCheckbox && roomsWrapper) {
        const toggleRoomsSection = () => {
            if (hasMultipleRoomsCheckbox.checked) {
                roomsWrapper.style.display = 'block';
                // Add at least one room field if empty
                if (roomsListContainer && roomsListContainer.children.length === 0) {
                    addRoomRow();
                }
            } else {
                roomsWrapper.style.display = 'none';
            }
        };

        hasMultipleRoomsCheckbox.addEventListener('change', toggleRoomsSection);
        toggleRoomsSection(); // Run initially
    }

    if (addRoomBtn && roomsListContainer) {
        addRoomBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addRoomRow();
        });
    }

    function addRoomRow() {
        if (!roomsListContainer) return;
        const rowId = 'room-row-' + Date.now();
        const div = document.createElement('div');
        div.className = 'room-input-row';
        div.id = rowId;
        div.innerHTML = `
            <input type="text" name="room_names[]" placeholder="e.g. Room A1, Bedsitter" required />
            <input type="number" name="room_prices[]" placeholder="Rent KES" min="1" required />
            <button type="button" class="btn btn-danger btn-sm remove-room-btn" onclick="document.getElementById('${rowId}').remove()">
                <i class="fas fa-trash"></i>
            </button>
        `;
        roomsListContainer.appendChild(div);
    }

    // 5. M-Pesa STK Push Overlay & Checkout Wizard Simulators
    const mpesaCheckoutForms = document.querySelectorAll('.mpesa-checkout-trigger-form');
    mpesaCheckoutForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit';
            
            // Get form parameters
            const formData = new FormData(form);
            const phoneNumber = formData.get('phone_number') || '';
            const amount = formData.get('amount') || '100';
            const paymentType = formData.get('payment_type') || 'listing_fee';
            const listingId = formData.get('listing_id') || '';

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Triggering STK Push...';
            }

            // Trigger STK prompt modal in document
            showMpesaStkModal(phoneNumber, amount, async (pinCode) => {
                // Call real express backend route
                try {
                    const response = await fetch('/payment/mpesa-express', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone_number: phoneNumber,
                            amount: amount,
                            payment_type: paymentType,
                            listing_id: listingId,
                            pin: pinCode
                        })
                    });
                    const result = await response.json();
                    
                    if (result.success) {
                        showGlobalNotification('success', 'M-Pesa STK Push initiated successfully! Staff will verify and approve your payment shortly.');
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    } else {
                        showGlobalNotification('danger', result.message || 'Payment initiation failed.');
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalBtnText;
                        }
                    }
                } catch (err) {
                    showGlobalNotification('danger', 'Error connecting to payment processor.');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                    }
                }
            }, () => {
                // Cancelled callback
                showGlobalNotification('warning', 'M-Pesa STK Prompt cancelled.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            });
        });
    });

    function showMpesaStkModal(phoneNumber, amount, onApprove, onCancel) {
        // Check if modal container already exists, otherwise create it
        let modal = document.getElementById('mpesa-stk-popup-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mpesa-stk-popup-modal';
            modal.className = 'stk-modal-backdrop';
            document.body.appendChild(modal);
        }

        // Draw Safaricom themed STK prompt on screen
        modal.innerHTML = `
            <div class="stk-modal-card">
                <div class="stk-header">
                    <img src="/images/favicon.svg" alt="Makao" class="stk-logo" />
                    <span>M-PESA Express</span>
                </div>
                <div class="stk-body">
                    <div class="stk-phone-display">
                        <div class="stk-phone-screen">
                            <div class="stk-safaricom-title">M-PESA</div>
                            <p class="stk-push-msg">Do you want to pay KES ${parseFloat(amount).toLocaleString()} to MAKAO REALTORS for account Broker Services?</p>
                            <input type="password" id="stk-pin-field" placeholder="Enter 4-Digit M-Pesa PIN" maxlength="4" autofocus />
                            <div class="stk-screen-buttons">
                                <button type="button" id="stk-btn-cancel" class="stk-screen-btn">Cancel</button>
                                <button type="button" id="stk-btn-ok" class="stk-screen-btn">OK</button>
                            </div>
                        </div>
                    </div>
                    <div class="stk-instructions">
                        <p><strong>Simulated Safe Checkout:</strong></p>
                        <p>Enter any 4-digit PIN (e.g. <code>1234</code>) to simulate a successful Safaricom Push. Enter <code>0000</code> to simulate a failed/rejected transaction.</p>
                        <p>Sent to Safaricom Number: <strong>${phoneNumber}</strong></p>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        // Add event listeners inside STK frame
        const pinField = modal.querySelector('#stk-pin-field');
        const btnCancel = modal.querySelector('#stk-btn-cancel');
        const btnOk = modal.querySelector('#stk-btn-ok');

        const closeModal = () => {
            modal.style.display = 'none';
        };

        btnCancel.addEventListener('click', () => {
            closeModal();
            onCancel();
        });

        btnOk.addEventListener('click', () => {
            const pin = pinField.value.trim();
            if (pin.length < 4) {
                alert('Please enter a 4-digit M-Pesa PIN');
                return;
            }
            closeModal();
            onApprove(pin);
        });

        // Keypress listeners
        pinField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                btnOk.click();
            }
        });
    }

    // 6. Global Notification Alerts Helper
    function showGlobalNotification(type, message) {
        let container = document.getElementById('global-alert-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'global-alert-container';
            container.className = 'global-alert-wrapper';
            document.body.appendChild(container);
        }

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show slide-in-up`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            <span>${message}</span>
            <button type="button" class="btn-close" onclick="this.parentElement.remove()" aria-label="Close">&times;</button>
        `;
        container.appendChild(alertDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }
});
