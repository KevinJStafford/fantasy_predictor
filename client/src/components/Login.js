import {TextField, Button, Container, Box} from '@mui/material';
import {useFormik} from 'formik';
import * as yup from 'yup';
import {useHistory} from 'react-router-dom';
import { apiUrl } from '../utils/api';
import { saveToken } from '../utils/auth';

import Navbar from './Navbar'

function Login({setUser}) {
    const history = useHistory();
    const loginSchema = yup.object().shape({
        username: yup.string()
        .required('Username is Required!'),
        password: yup.string()
        .required('Password is Required!')
    })

    const formik = useFormik({
        initialValues: {
            username: '',
            password: '',
        },
        validationSchema: loginSchema,
        onSubmit: (values) => {
            fetch(apiUrl('/api/v1/login'), {
                method: 'POST',
                headers: {
                    "Content-type": 'application/json'
                },
                body: JSON.stringify(values)
            }).then((resp) => {
                if (resp.ok) {
                    resp.json().then(({user, token}) => {
                        if (token) {
                            saveToken(token)
                        }
                        setUser(user)
                        history.push('/player')
                    })
                } else {
                    resp.json().then((data) => {
                        console.error('Login error:', data.error || 'Login failed')
                        alert(data.error || 'Login failed. Please check your username and password.')
                    }).catch(() => {
                        alert('Login failed. Please try again.')
                    })
                }
            }).catch((error) => {
                console.error('Login request error:', error)
                alert('Failed to connect to server. Please try again.')
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
                    id="password" 
                    label="password"
                    type="password"
                    variant="standard"
                    error={!!formik.errors.password}
                    helperText={formik.errors.password}
                    required
                    value={formik.values.password}
                    onChange={formik.handleChange}/>
                </Box>
                <hr></hr>
                <Button fullWidth='True' variant="outlined" type="submit">Submit</Button>
            </form>
        </Container>
            </div>
        </main>
    )
}

export default Login;