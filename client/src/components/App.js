import React, { useState } from "react";
import { Switch, Route } from "react-router-dom";

import Signup from './Signup'
import TestSignup from './TestSignup'
import Navbar from './Navbar'
import LandingGrid from "./LandingGrid"
import Login from "./Login"
import Members from "./Members"


function App() {
  console.log('=== APP COMPONENT RENDERING ===');
  console.log('Current pathname:', window.location.pathname);
  // eslint-disable-next-line no-unused-vars
  const [user, setUser] = useState(null)

  // Test: render something before Switch to verify App is rendering
  return (
    <main>
      <div style={{ padding: '20px', backgroundColor: 'yellow', fontSize: '20px' }}>
        APP IS RENDERING - Path: {window.location.pathname}
      </div>
      <Switch>
        <Route exact path="/">
          <Navbar />
          <LandingGrid />
      </Route>
      <Route path="/users">
        <div style={{ padding: '20px', backgroundColor: 'orange', fontSize: '20px' }}>
          ROUTE /users MATCHED!
        </div>
        <TestSignup />
        <Signup setUser={setUser} />
      </Route>
      <Route exact path="/login">
        <Login setUser={setUser} />
      </Route>
      <Route exact path="/player">
        <Members />
      </Route>
      <Route exact path="/results">
        {/* <Results /> */}
      </Route>
      </Switch>
      </div>
    </main>
  );
}

export default App;
