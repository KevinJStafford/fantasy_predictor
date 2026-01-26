import React, { useState } from "react";
import { Switch, Route } from "react-router-dom";

import Signup from './Signup'
import TestSignup from './TestSignup'
import Navbar from './Navbar'
import LandingGrid from "./LandingGrid"
import Login from "./Login"
import Members from "./Members"


function App() {
  console.log('App component rendering, current path:', window.location.pathname);
  // eslint-disable-next-line no-unused-vars
  const [user, setUser] = useState(null)


  console.log('App rendering, pathname:', window.location.pathname);
  return (
    <main>
      <Switch>
        <Route exact path="/">
          <Navbar />
          <LandingGrid />
      </Route>
      <Route exact path="/users">
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
    </main>
  );
}

export default App;
