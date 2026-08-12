import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

import {
    startLinkSession,
    respondToScannedQr,
} from '@/utils/cryptoUtils';

import styles from '../../styles/Authentification/LinkDevice.module.css';


const LinkDevice = () => {
    const [mode, setMode] = useState(null); // null | 'show' | 'scan'
    const [qrPayload, setQrPayload] = useState(null);
    const [status, setStatus] = useState('idle'); // idle | waiting | linked | error
    const [errorMsg, setErrorMsg] = useState('');

    const abortRef = useRef(null);
    const scannerRef = useRef(null);

    const navigate = useNavigate();


    useEffect(() => {
        return () => {
            abortRef.current?.abort();

            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
                scannerRef.current.clear().catch(() => {});
            }
        };
    }, []);


    useEffect(() => {
        if (mode !== 'scan') return;

        let isMounted = true;
        let isScanning = false;

        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;


        const startScanner = async () => {
            try {
                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: 250,
                    },
                    async (decodedText) => {

                        if (isScanning) return;
                        isScanning = true;

                        try {
                            scanner.pause();

                            if (isMounted) {
                                setStatus('waiting');
                            }


                            const controller = new AbortController();
                            abortRef.current = controller;


                            const result = await respondToScannedQr(decodedText);


                            if (!result.done) {
                                await result.waitForKey({
                                    signal: controller.signal,
                                });
                            }


                            if (isMounted) {
                                setStatus('linked');

                                setTimeout(() => {
                                    navigate('/');
                                }, 1000);
                            }


                        } catch (err) {

                            if (isMounted) {
                                console.error(err);

                                setStatus('error');

                                setErrorMsg(
                                    err.message ||
                                    'Failed to complete linking.'
                                );

                                isScanning = false;

                                scanner.resume();
                            }
                        }
                    },

                    () => {
                        // Ignore scan frame errors
                    }
                );


            } catch (err) {

                if (isMounted) {
                    console.error(err);

                    setStatus('error');

                    setErrorMsg(
                        err.message ||
                        'Could not access the camera. Check HTTPS or permissions.'
                    );
                }
            }
        };


        startScanner();


        return () => {

            isMounted = false;

            if (scannerRef.current) {

                scannerRef.current
                    .stop()
                    .catch(() => {})
                    .finally(() => {
                        scannerRef.current.clear().catch(() => {});
                    });
            }
        };


    }, [mode, navigate]);



    const handleShowQR = async () => {

        setMode('show');
        setStatus('waiting');
        setErrorMsg('');


        try {

            const {
                qrPayload,
                waitForCompletion
            } = await startLinkSession();


            setQrPayload(qrPayload);


            const controller = new AbortController();

            abortRef.current = controller;


            await waitForCompletion({
                signal: controller.signal,
            });


            setStatus('linked');


            setTimeout(() => {
                navigate('/');
            }, 1000);


        } catch (err) {

            console.error(err);

            setStatus('error');

            setErrorMsg(
                err.message ||
                'Linking failed. Please try again.'
            );
        }
    };



    const handleScanQR = () => {

        setErrorMsg('');
        setStatus('idle');
        setMode('scan');

    };



    const reset = () => {

        abortRef.current?.abort();


        if (scannerRef.current) {

            scannerRef.current
                .stop()
                .catch(() => {});

            scannerRef.current
                .clear()
                .catch(() => {});
        }


        setMode(null);
        setQrPayload(null);
        setStatus('idle');
        setErrorMsg('');

    };



    return (

        <div className={styles.container}>

            <h1 className={styles.title}>
                Link this device
            </h1>


            <p className={styles.description}>
                To read your encrypted messages here, link this device using another
                device where you're already logged in. You can find this option in the
                Messages page on your other device to scan or display the QR code.
            </p>



            {!mode && (

                <div className={styles.buttonGroup}>

                    <button
                        className={styles.button}
                        onClick={handleShowQR}
                    >
                        Show QR code
                    </button>


                    <button
                        className={`${styles.button} ${styles.secondaryButton}`}
                        onClick={handleScanQR}
                    >
                        Scan a QR code
                    </button>


                    <button
                        className={`${styles.button} ${styles.skipButton}`}
                        onClick={() => navigate('/')}
                    >
                        Skip for now
                    </button>

                </div>

            )}



            {mode === 'show' && (

                <div className={styles.content}>

                    {qrPayload && status === 'waiting' && (

                        <div className={styles.qrContainer}>

                            <QRCodeSVG
                                value={qrPayload}
                                size={220}
                            />


                            <p className={styles.status}>
                                Open your other device and scan this QR code.
                            </p>

                        </div>

                    )}



                    {status === 'linked' && (

                        <p className={styles.success}>
                            ✅ Device linked successfully!
                        </p>

                    )}



                    {status === 'error' && (

                        <>
                            <p className={styles.error}>
                                {errorMsg}
                            </p>


                            <button
                                className={styles.button}
                                onClick={reset}
                            >
                                Try again
                            </button>
                        </>

                    )}

                </div>

            )}




            {mode === 'scan' && (

                <div className={styles.content}>


                    <div
                        id="qr-reader"
                        className={styles.scanner}
                    />



                    {status === 'waiting' && (

                        <p className={styles.status}>
                            Completing link...
                        </p>

                    )}



                    {status === 'linked' && (

                        <p className={styles.success}>
                            ✅ Device linked successfully!
                        </p>

                    )}



                    {status === 'error' && (

                        <>

                            <p className={styles.error}>
                                {errorMsg}
                            </p>


                            <button
                                className={styles.button}
                                onClick={reset}
                            >
                                Try again
                            </button>

                        </>

                    )}

                </div>

            )}

        </div>

    );
};


export default LinkDevice;