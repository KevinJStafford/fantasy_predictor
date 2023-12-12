// import React, { useEffect, useState } from "react";
import { Switch, Route } from "react-router-dom";
import Signup from './Signup'

import Navbar from './Navbar'

function App() {
  return (
    <main>
      <Switch>
        <Route exact path="/">
          <Navbar />
          {/* <LandingGrid />; */}
      </Route>
      <Route exact path="/join">
        <Signup />
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
