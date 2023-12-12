import { useState } from 'react';
import {TextField, Button, Container, Box} from '@mui/material';
import {useFormik} from 'formik';
import * as yup from 'yup';

import Navbar from './Navbar'

function Signup({setUser}) {
    const [signup, setSignup] = useState(true)

    const signupSchema = yup.object().shape({
        username: yup.string()
        .min(5, 'Too short!')
        .max(18, 'Too long!')
        .required('Required!'),
        email: yup.string().email('Invalid email'),
        password: yup.string()
        .min(5, 'Too short!')
        .max(18, 'Too long!')
        .required('Required!')
    })

    const formik = useFormik({
        initialValues: {
            username: '',
            email: '',
            password: '',
            passwordConfirmation: ''
        },
        validationSchema: signupSchema,
        onSubmit: (values) => {
            const endpoint = '/join'
            fetch(endpoint, {
                method: 'POST',
                headers: {
                    "Content-type": 'application/json'
                },
                body: JSON.stringify(values)
            }).then((resp) => {
                if (resp.ok) {
                    resp.json().then(({user}) => {
                    setUser(user)
                    })
                } else {
                    console.log('errors? handle error')
                }
            })
        }
    })

    return(
        <main>
            <Navbar />
            <div>
            {/* {formik.errors} */}

        <Container maxWidth="sm">
            <form onSubmit={formik.handleSubmit}>
                <Box>
                <TextField 
                    id="username" 
                    label="Username" 
                    variant="standard"
                    value={formik.values.username}
                    onChange={formik.handleChange}
                />
                </Box>
                <Box>
                <TextField 
                    id="email" 
                    label="email" 
                    variant="standard"
                    value={formik.values.email}
                   onChange={formik.handleChange}
                  />
                </Box>
                <Box>
                <TextField 
                    id="password" 
                    label="password"
                    type="password"
                    variant="standard"
                    value={formik.values.password}
                    onChange={formik.handleChange} 
                  />
                </Box>
                <Button variant="outlined" type="submit">Submit</Button>
            </form>
        </Container>
            </div>
        </main>
    )
}

export default Signup