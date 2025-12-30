import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';

function App() {
  const { user, login, signup, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Функция для входа
  const handleLogin = async () => {
    const { data, error } = await login(email, password);
    if (error) alert('Login error: ' + error.message);
    else console.log('Login success:', data);
  };

  // Функция для регистрации
  const handleSignup = async () => {
    const { data, error } = await signup(email, password);
    if (error) alert('Signup error: ' + error.message);
    else console.log('Signup success:', data);
  };

  // Если пользователь не авторизован — показываем форму
  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Login / Signup</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <br />
        <button onClick={handleLogin} style={{ marginRight: 10 }}>Login</button>
        <button onClick={handleSignup}>Sign Up</button>
      </div>
    );
  }

  // Пользователь авторизован — показываем приветствие
  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome, {user.email}</h1>
      <p>Your UID: {user.id}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default App;
