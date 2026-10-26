import styled from 'styled-components/macro';
import tw from 'twin.macro';

const Label = styled.label<{ isLight?: boolean }>`
    ${tw`block text-xs font-medium text-gray-300 mb-1.5`};
    ${(props) => props.isLight && tw`text-gray-300`};
`;

export default Label;
