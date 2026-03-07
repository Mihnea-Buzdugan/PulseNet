import React, { useState, useEffect, useRef } from 'react';
import styles from '../../styles/Authentification/registration.module.css';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-regular-svg-icons';
import {GoogleLogin} from "@react-oauth/google";

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const csrfFetched = useRef(false);

    useEffect(() => {
        if (csrfFetched.current) return;
        csrfFetched.current = true;

        fetch('http://localhost:8000/accounts/csrf-token/', {
            method: 'GET',
            credentials: 'include',
        })
            .then((response) => {
                if (response.ok) return response.json();
                throw new Error('Failed to fetch CSRF token');
            })
            .then((data) => {
                console.log('Fetched CSRF token (response):', data.csrf_token);
            })
            .catch((error) => console.error('Error fetching CSRF token:', error));
    }, []);

    const togglePasswordVisibility = () => {
        setShowPassword((prev) => !prev);
    };

    const handleSignUpClick = () => {
        navigate('/Signup');
    };

    const handleAdminLoginClick = () => {
        navigate('/adminlogin');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const csrfToken = getCookie('csrftoken');
        if (!csrfToken) {
            alert('CSRF token is missing!');
            return;
        }

        const userData = {
            email,
            password,
        };

        try {
            const response = await fetch('http://localhost:8000/accounts/user_login/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify(userData),
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Login successful:', data);
                const expirationTime = new Date();
                expirationTime.setHours(expirationTime.getHours() + 6);
                localStorage.setItem('auth-token', 'true');
                localStorage.setItem('token-expiration', expirationTime.toString());
                setTimeout(() => {
                    window.location.href = '/'; // Redirect to home page
                }, 0);
            } else {
                const errorData = await response.json();
                alert('Error: ' + errorData.message);
            }
        } catch (error) {
            console.error('Error during login:', error);
            alert('There was an error during login');
        }
    };


    const handleGoogleLogin = async (response) => {
        const googleToken = response.credential; // Tokenul Google

        console.log("Google Token: ", googleToken);
        const csrfToken = getCookie('csrftoken');
        if (!csrfToken) {
            alert('CSRF token is missing.');
            return;
        }

        const resp = await fetch('http://localhost:8000/accounts/google_login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            credentials: 'include',
            body: JSON.stringify({ google_token: googleToken })  // Trimite tokenul Google către backend
        });
        if (resp.ok) {
            const data = await resp.json();
            console.log(data);
            navigate('/');
            const exp = new Date();
            exp.setHours(exp.getHours() + 6);
            localStorage.setItem('auth-token', 'true');
            localStorage.setItem('token-expiration', exp.toString());
        } else {
            const err = await resp.json();
            alert(err.message);
        }
    };


    return (
        <div>
            <div className={styles['custom-shape-divider-bottom-1740491939']}>
                <svg
                    data-name="Layer 1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1200 120"
                    preserveAspectRatio="none"
                >
                    <path
                        d="M598.97 114.72L0 0 0 120 1200 120 1200 0 598.97 114.72z"
                        className={styles['shape-fill']}
                    ></path>
                </svg>
            </div>
            <img src="/logo.png" className={styles.harta} alt="Map" />
            <div className={styles['main-container']}>
                <div className={styles.signup}>
                    <h1 className={styles['signup-titlu']}>Login into your account</h1>
                    <div className="email">
                        <input
                            type="email"
                            className={styles.inputs}
                            required
                            autoComplete="off"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className={styles.parole}>
                        <div className={styles['password-fields']}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className={styles.inputs}
                                required
                                autoComplete="off"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <span
                                className={styles['toggle-passwords']}
                                onClick={togglePasswordVisibility}
                            >
                <FontAwesomeIcon
                    icon={showPassword ? faEye : faEyeSlash}
                    className={styles.customIcon}
                />
              </span>
                        </div>
                    </div>

                    <div className="sign-up">
                        <button className={styles['buton-signup']} onClick={handleSubmit}>
                            LOGIN
                        </button>
                        <div className={styles.with}>
                            <p>Or with</p>
                        </div>
                        <div className={styles.providers}>
                            <GoogleLogin
                                onSuccess={(credentialResponse) => {
                                    handleGoogleLogin(credentialResponse);
                                }}
                                onError={() => alert("Login failed.")}
                            >
                            </GoogleLogin>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.text}>
                <h1 className={styles['titlu-text']}>New here?</h1>
                <div className={styles['welcome-text']}>
                    Click on the sign-up page to create your account and start your journey with us!
                </div>
                <button onClick={handleSignUpClick} className={styles.ionut}>
                    Sign up
                </button>
            </div>
        </div>
    );
};

export default Login;