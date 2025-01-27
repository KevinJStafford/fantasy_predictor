import * as React from 'react'
import { Card } from "@mui/material"
import {TextField, Button, Container, Box} from '@mui/material';
import {useFormik} from 'formik';
import { useState } from 'react';



function Predictions({filteredFixtures}) {
    const {fixture_round, fixture_date, fixture_home_team, fixture_away_team, id} = filteredFixtures

    const formik = useFormik({
        initialValues: {
            game_week: '',
            home_team: '',
            home_team_score: '',
            away_team: '',
            away_team_score: '',
        },
        onSubmit: (values) => {
            fetch('/games', {
                method: 'POST',
                headers: {
                    "Content-type": 'application/json'
                },
                body: JSON.stringify(values)
            })
            // .then((resp) => {
            //     if (resp.ok) {
            //         resp.json().then(({user}) => {
            //         setUser(user)
            //         })
            //     } else {
            //         console.log('errors? handle error')
            //     }
            // })
        }
    })

    return (
        <Card id={id}>
            <div>
                <p>{fixture_round}</p>
                <Container>
                <p>{fixture_home_team}</p>
                </Container>
                <p>{fixture_away_team}</p>
                <p>{fixture_date}</p>
                
            </div>
        </Card>
    )

}

export default Predictions;