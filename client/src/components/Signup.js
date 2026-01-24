import {TextField, Button, Container, Box} from '@mui/material';
import {useFormik} from 'formik';
import * as yup from 'yup';
import {useHistory} from 'react-router-dom';
import { apiUrl } from '../utils/api';

import Navbar from './Navbar'

function Signup({setUser}) {
    const history = useHistory();

    const signupSchema = yup.object().shape({
        username: yup.string()
        .min(5, 'Username is too short!')
        .max(18, 'Username is too long!')
        .required('Username is Required!'),
        email: yup.string().email('Invalid email'),
        password: yup.string()
        .min(5, 'Password is too short!')
        .max(18, 'Password is too long!')
        .required('Password is Required!')
    })

    const formik = useFormik({
        initialValues: {
            username: '',
            email: '',
            password: '',
        },
        validationSchema: signupSchema,
        onSubmit: (values) => {
            fetch(apiUrl('/api/v1/users'), {
                method: 'POST',
                headers: {
                    "Content-type": 'application/json'
                },
                body: JSON.stringify(values)
            }).then((resp) => {
                if (resp.ok) {
                    resp.json().then(({user}) => {
                    setUser(user)
                    history.push('/player')
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
        <hr></hr>
        <Container maxWidth="xs">
            <form onSubmit={formik.handleSubmit}>
                <Box>
                <TextField
                    sx={{ width: 1}}
                    id="username" 
                    label="Username" 
                    variant="standard"
                    error={!!formik.errors.username}
                    helperText={formik.errors.username}
                    required
                    value={formik.values.username}
                    onChange={formik.handleChange}
                />
                </Box>
                <Box>
                <TextField 
                    sx={{ width: 1}}
                    id="email" 
                    label="email" 
                    variant="standard"
                    error={!!formik.errors.email}
                    helperText={formik.errors.email}
                    value={formik.values.email}
                   onChange={formik.handleChange}
                  />
                </Box>
                <Box>
                <TextField 
                    sx={{ width: 1}}
                    id="password" 
                    label="password"
                    type="password"
                    variant="standard"
                    error={!!formik.errors.password}
                    helperText={formik.errors.password}
                    required
                    value={formik.values.password}
                    onChange={formik.handleChange} 
                  />
                </Box>
                <hr></hr>
                <Button fullWidth='True'variant="outlined" type="submit">Submit</Button>
            </form>
        </Container>
            </div>
        </main>
    )
}

export default Signup