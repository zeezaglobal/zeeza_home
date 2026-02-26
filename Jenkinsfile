pipeline {
    agent any

    environment {
        IMAGE_NAME = 'zeezaglobal'
        CONTAINER_NAME = 'zeezaglobal'
        PORT = '3000'
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/zeezaglobal/zeeza_home.git'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh """
                    echo "🛠 Building Docker image..."
                    docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest .
                """
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    echo "🚀 Deploying container..."
                    docker stop $CONTAINER_NAME 2>/dev/null || true
                    docker rm $CONTAINER_NAME 2>/dev/null || true

                    docker run -d \
                        --name $CONTAINER_NAME \
                        --restart unless-stopped \
                        -p $PORT:3000 \
                        $IMAGE_NAME:latest

                    # Verify container started
                    sleep 5
                    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
                        echo "✅ Container started successfully"
                    else
                        echo "❌ Container failed to start"
                        docker logs $CONTAINER_NAME
                        exit 1
                    fi
                '''
            }
        }

        stage('Cleanup Old Images') {
            steps {
                sh '''
                    docker images $IMAGE_NAME --format "{{.Tag}}" | \
                        grep -v latest | \
                        sort -rn | \
                        tail -n +4 | \
                        xargs -r -I {} docker rmi $IMAGE_NAME:{} || true
                '''
            }
        }
    }

    post {
        success {
            echo "✅ Zeeza Global deployed successfully on port ${PORT}"
        }
        failure {
            echo "❌ Deployment failed!"
            sh "docker logs ${CONTAINER_NAME} 2>/dev/null || true"
        }
    }
}