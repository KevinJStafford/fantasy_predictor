import * as React from 'react'
import Navbar from './Navbar'
import Predictions from './Predictions'
import {useEffect, useState} from 'react'
import { Container, Typography } from '@mui/material'


function Members() {
    const [fixtures, setFixtures] = useState([])
    const [filteredFixtures, setFilteredFixtures] = useState([])
    const [gameWeek, setGameWeek] = useState('')

    function getFixtures() {
        fetch('/fixtures')
        .then(response => response.json())
        .then(fixturesData => setFixtures(fixturesData))
    }

    console.log(fixtures)

    useEffect(getFixtures, []);

    const handleDropdownChange = (e) => {
        const selectedValue = e.target.value;
        setGameWeek(selectedValue);
        const filteredResults = fixtures.filter(fixture => fixture.fixture_round === selectedValue)
        setFilteredFixtures(filteredResults)
    
    }

    console.log("reuslts", filteredFixtures)

    return (
        <>
        <Navbar />
        <div>
        <Typography variant="h5" component="h2"><span>Select Game Week:</span></Typography>
          <select value={gameWeek} onChange={handleDropdownChange}>
            <option value="all">All</option>
            <option value="18">18</option>
            <option value="19">19</option>
          </select>

        <Typography variant="h2" component="h2"><span>Fixtures</span></Typography>
        <Container maxWidth='sm'>
            {filteredFixtures.map(fixture => <Predictions  key={fixture.id} fixtures={filteredFixtures}  />)}
        </Container>
        </div>
        </>
      );
}

export default Members;