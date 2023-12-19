import React, { useState } from "react";
import { Switch, Route } from "react-router-dom";

import Signup from './Signup'
import Navbar from './Navbar'
import LandingGrid from "./LandingGrid"
import Login from "./Login"


function App() {
  const [user, setUser] = useState(null)


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
        <Login />
      </Route>
      <Route exact path="/user">
        {/* <Members /> */}
      </Route>
      <Route exact path="/results">
        {/* <Results /> */}
      </Route>
      </Switch>
    </main>
  );
}

export default App;
