<script>
  	import { faShareAlt } from '@fortawesome/free-solid-svg-icons';
	import Icon from 'svelte-awesome';
  	import { facebook, twitter, instagram, linkedin, download } from 'svelte-awesome/icons';

	const arrImg = [ 'https://firebasestorage.googleapis.com/v0/b/kyyeudreamer-ab5bc.appspot.com/o/concept%2F13.jpg?alt=media&token=66482bed-a750-43ed-8b87-f92950c68035' 
					,'https://firebasestorage.googleapis.com/v0/b/kyyeudreamer-ab5bc.appspot.com/o/concept%2F1.jpg?alt=media&token=2bc889b4-1911-4d1b-82cc-208397fbaf4e' 
					, 'https://firebasestorage.googleapis.com/v0/b/kyyeudreamer-ab5bc.appspot.com/o/concept%2F14.jpg?alt=media&token=a77cc19f-fc44-4813-8cf9-c07916990bfe' 
					, 'https://firebasestorage.googleapis.com/v0/b/kyyeudreamer-ab5bc.appspot.com/o/concept%2F4.jpg?alt=media&token=d141000f-babf-404e-8875-fe73fb1c2184' 
					, 'https://firebasestorage.googleapis.com/v0/b/kyyeudreamer-ab5bc.appspot.com/o/concept%2F6.jpg?alt=media&token=6073e825-533a-4475-beed-ec1ab4cb519c' 
					, 'https://firebasestorage.googleapis.com/v0/b/kyyeudreamer-ab5bc.appspot.com/o/concept%2F12.jpg?alt=media&token=40c83687-d878-4818-af99-ce9e74bdeb32' 
					, 'https://firebasestorage.googleapis.com/v0/b/kyyeudreamer-ab5bc.appspot.com/o/concept%2F11.jpg?alt=media&token=897fd66e-0964-4d56-bcb9-d426423537a3' 
					, 'https://firebasestorage.googleapis.com/v0/b/kyyeudreamer-ab5bc.appspot.com/o/concept%2F5.jpg?alt=media&token=f4a833cd-7cd0-4d76-a001-1ae2a0bb9f15']
	const randomNum =  Math.floor(Math.random() * arrImg.length);
	const randomImg = arrImg[randomNum]
	
	// const quotes = ['Marry Christmas. and Happy New Year!']
	// if(quotes.body.includes(".")){
	// 	const newQuotes = quotes[0].split('.')
	// 	console.log(newQuotes)
	// }

	const quotes = {
		body: "Không chỉ riêng ở Ý mà ngay tại nhiều quốc gia trên thế giới, việc trộm cắp các tác phẩm cổ từ lâu đã không có gì quá xa lạ. Ngay từ thời xa xưa, đây đã làm một vấn nạn khó có thể kiểm soát được. Tuy nhiên hiện nay, do tình hình bất ổn của đại dịch Covid-19",
		author: "Thanh Binh"
	}
	const quotesLength = quotes.body.length


	

</script>

<div class="background relative flex flex-col h-screen items-center justify-center text-center relative" style="background: url({randomImg}) no-repeat center center/cover">
	<div class="m-0 p-0 text-white absolute z-10">
		<p class="text mb-6" class:changeFontSize={quotesLength > 40}>{quotes.body}</p>
		<p class="authorText text-right w-3/5">Thanh Bình</p>
	</div>

	<div class="absolute z-10 top-4 right-2 lg:top-6 lg:right-8 flex flex-col gap-4">
		<div class="shareBtn w-60 h-12 relative flex items-center justify-evenly overflow-hidden cursor-pointer">
			<span 
				class="absolute w-full h-full text-2xl" 
				style="background: #2d3436; color: #f1f1f1; line-height: 3rem; z-index: 999; transition: .6s linear; border-radius: 40px;"
			>
				<Icon data={faShareAlt} scale="2" style="margin-bottom: .5rem; margin-right: 1rem;"/> Share!
			</span>
			<button class="social-fb"><Icon scale="2" data={facebook}/></button>
			<button class="social-tw"><Icon scale="2" data={twitter}/></button>
			<button class="social-ins"><Icon scale="2" data={instagram}/></button>
			<button class="social-linked"><Icon scale="2" data={linkedin}/></button>
		</div>

		<div class="w-60 h-12">
			<button class="downloadBtn w-full h-full text-2xl outline-none border-none cursor-pointer">
				<Icon scale="2" data={download} style="margin-right: 1rem;"/>Get Image
			</button>
		</div>
	</div>

</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Charm&display=swap');
	.background:after{
		content: "";
  		position: absolute;
  		left: 0;
  		top: 0;
  		width: 100%;
  		height: 100%;
  		background-color: rgba(0, 0, 0, 0.4);
  		background-image: linear-gradient(
    		to top,
    	rgba(0, 0, 0, 0.8),
    	rgba(0, 0, 0, 0) 60%,
    	rgba(0, 0, 0, 0.8) 100%
  		);
	}
	.changeFontSize{
		font-size: 1.9rem !important;
	}
	.text {
		font-family: 'Charm', cursive;
		font-size: 4rem;
	}
	.authorText{
		font-size: 1.5rem;
		margin: 0 auto;
	}
	.shareBtn{
		background: #dfe6e9;
		transition: .3s linear;
		border-radius: 40px;
	}
	.shareBtn:hover{
		transform: scale(1.1);
	}
	.shareBtn:hover span{
		transform: translateX(-100%);
		transition-delay: .3s;
	}
	.shareBtn button{
		text-align: center;
		border: none;
		outline: none;
		opacity: 0;
		transform: translateX(-100%);
		transition: .3s linear;
	}
	.shareBtn:hover button{
		opacity: 1;
		transform: translateX(0);
	}
	.shareBtn button:nth-of-type(1){
		transition-delay: 1s;
	}
	.shareBtn button:nth-of-type(2){
		transition-delay: .8s;
	}
	.shareBtn button:nth-of-type(3){
		transition-delay: .6s;
	}
	.shareBtn button:nth-of-type(4){
		transition-delay: .4s;
	}
	.social-fb{
		color: #3B5998;
	}
	.social-tw{
		color: #00ACEE;
	}
	.social-ins{
		color: #d6249f;
	}
	.social-linked{
		color: #0E76A8;
	}
	.downloadBtn{
		background: #2d3436;
		color: #f1f1f1;
		border-radius: 40px;
		transition: .3s linear;
	}
	.downloadBtn:hover{
		transform: scale(1.1);
		background: #dfe6e9;
		color: #2d3436;
	}
</style>
