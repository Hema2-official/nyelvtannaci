import ky from 'ky';

const apiClient = ky.create({
	timeout: false,
	headers: {
		'Content-Type': 'application/json'
	}
});

export default apiClient;
