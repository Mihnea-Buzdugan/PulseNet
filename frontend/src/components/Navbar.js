import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/Components/navbar.module.css';

function Navbar() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [menuActive, setMenuActive] = useState(false);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('auth-token');
        const tokenExpiration = localStorage.getItem('token-expiration');
        if (token && tokenExpiration) {
            const expirationTime = new Date(tokenExpiration);
            if (new Date() < expirationTime) {
                setIsAuthenticated(true);
            } else {
                localStorage.removeItem('auth-token');
                localStorage.removeItem('token-expiration');
            }
        }
    }, []);

    useEffect(() => {
        fetch('http://localhost:8000/accounts/user/', { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => setUser(data))
            .catch(console.error);
    }, []);

    const handleLogout = async () => {
        await fetch('http://localhost:8000/accounts/logout/', { method: 'POST', credentials: 'include' });
        localStorage.removeItem('auth-token');
        localStorage.removeItem('token-expiration');
        setIsAuthenticated(false);
        navigate('/Login');
    };

    const navItems = isAuthenticated
        ? [
            'Home',
            'Profile',
            'Logout',
        ]
        : ['Home', 'Login'];

    const toggleMenu = () => setMenuActive(!menuActive);

    const renderNavItem = (item, index) => {
        if (!item) return null;

        const handlers = {
            Logout: handleLogout,
            Profile: () => navigate('/profile'),
            Login: () => navigate('/login'),
            Home: () => navigate('/'),
        };

        return (
            <div
                key={index}
                className={styles.sus}
                onClick={handlers[item] || null}
            >
                {item}
            </div>
        );
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.right}>
                <img src="/logo.png" alt="Logo" className={styles.logo} />
                <div className={styles.name}>PulseNet</div>
            </div>

            <div className={styles.left}>
                {navItems.map((item, i) => renderNavItem(item, i))}
            </div>

            <button className={styles.hamburger} onClick={toggleMenu}>
                &#9776;
            </button>

            <div className={`${styles.mobileMenu} ${menuActive ? styles.active : ''}`}>
                {navItems.map((item, i) => renderNavItem(item, i))}
            </div>
        </nav>
    );
}

export default Navbar;