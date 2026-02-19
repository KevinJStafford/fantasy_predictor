import React, { useState } from "react";
import { Switch, Route, Redirect } from "react-router-dom";

import Signup from './Signup';
import Navbar from './Navbar';
import LandingGrid from "./LandingGrid";
import Login from "./Login";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import Members from "./Members";
import Leagues from "./Leagues";
import Profile from "./Profile";

function App() {
  // eslint-disable-next-line no-unused-vars
  const [user, setUser] = useState(null);

  return (
    <main>
      <Switch>
        <Route exact path="/">
          <Navbar />
          <LandingGrid />
        </Route>
        <Route exact path="/users">
          <Signup setUser={setUser} />
        </Route>
        <Route exact path="/login">
          <Login setUser={setUser} />
        </Route>
        <Route exact path="/forgot-password">
          <ForgotPassword />
        </Route>
        <Route exact path="/reset-password">
          <ResetPassword />
        </Route>
        <Route exact path="/leagues">
          <Leagues />
        </Route>
        <Route exact path="/profile">
          <Profile />
        </Route>
        <Route exact path="/player">
          <Members />
        </Route>
        <Route exact path="/results">
          <Navbar />
          <div style={{ padding: 24 }}>Results (coming soon)</div>
        </Route>
        {/* Fallback: avoid blank screen if path doesn't match */}
        <Route path="*">
          <Redirect to="/" />
        </Route>
      </Switch>
    </main>
  );
}

export default App;
