import { useState } from 'react';
import {TextField, Button} from '@mui/material';
import {useFormik} from 'formik';
import * as yup from 'yup';

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
            password: ''
        },
        validationSchema: signupSchema,
        onSubmit: (values) => {
            const endpoint = signup ? '/users' : '/login'
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

    function toggleSignup() {
        setSignup((currentSignup) => !currentSignup)
    }

    return(
        <div>
            {/* {formik.errors} */}

        <form onSubmit={formik.handleSubmit}>
            <TextField 
                id="username" 
                label="Username" 
                variant="outlined"
                value={formik.values.username}
                onChange={formik.handleChange}
            />
            {signup && <TextField 
                id="email" 
                label="email" 
                variant="outlined"
                value={formik.values.email}
                onChange={formik.handleChange}
              />}
            <TextField 
                id="password" 
                label="password"
                type="password"
                variant="outlined"
                value={formik.values.password}
                onChange={formik.handleChange} 
              />
            <Button variant="contained" type="submit">Submit</Button>
            <Button variant='contained' onClick={toggleSignup}>{signup ? 'Login instead!' : 'Register for an account'}</Button>
        </form>
        </div>
    )
}

export default Signup