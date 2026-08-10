import ky from 'ky';

const apiClient = ky.create({
	headers: {
		'Content-Type': 'application/json'
	}
});

export default apiClient;
