import axios from 'axios';
import https from 'node:https';

const scraperAxios = axios.create({
	withCredentials: false,
	httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

export default scraperAxios;
