import React, { Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Loading from './components/Loading';


const Index = React.lazy(() => import('./pages/Index.js'));
const SignUp = React.lazy(() => import('./pages/SignUp.js'));
const Login = React.lazy(() => import('./pages/Login.js'));
const Profile = React.lazy(() => import('./pages/Profile.js'));
const SearchUsers = React.lazy(() => import('./pages/SearchUsers.js'));
const FollowRequests = React.lazy(() => import('./pages/FollowRequests.js'));

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    fetch('http://localhost:8000/accounts/user/', { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
          console.log("User Data:", data);
          setUser(data);
        })
        .catch(error => console.error("Error fetching user data:", error))
        .finally(() => setLoading(false));
  }, []);


  return (
      <div>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Index />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/login" element={<Login />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/search-users" element={<SearchUsers />} />
              <Route path="/follow-requests" element={<FollowRequests />} />
          </Routes>
        </Suspense>
      </div>
  );
}

export default App;